
#!/bin/bash
# Run from inside: freight-command-ai-main/afis-backend/
# Usage: bash setup-afis-backend.sh

set -e
echo "🚀 Setting up AFIS Backend files..."

mkdir -p src/config src/controllers src/middleware src/models src/routes src/services src/utils logs

# ═══════════════════════════════════════════════════════════════
# UTILS
# ═══════════════════════════════════════════════════════════════
cat > src/utils/logger.ts << 'EOF'
import winston from 'winston';
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, stack }) =>
      stack ? `[${timestamp}] ${level}: ${message}\n${stack}` : `[${timestamp}] ${level}: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
export default logger;
EOF

cat > src/utils/apiResponse.ts << 'EOF'
import { Response } from 'express';
export const sendSuccess = (res: Response, data: unknown, message = 'Success', statusCode = 200): Response =>
  res.status(statusCode).json({ success: true, message, data, timestamp: new Date().toISOString() });
export const sendError = (res: Response, message = 'Internal Server Error', statusCode = 500, errors?: unknown): Response =>
  res.status(statusCode).json({ success: false, message, errors, timestamp: new Date().toISOString() });
EOF

cat > src/utils/jwt.ts << 'EOF'
import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';
export interface JwtPayload { id: string; email: string; role: string; }
export const generateToken = (user: IUser): string => {
  const payload: JwtPayload = { id: (user._id as string).toString(), email: user.email, role: user.role };
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });
};
export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
EOF

# ═══════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════
cat > src/config/database.ts << 'EOF'
import mongoose from 'mongoose';
import logger from '../utils/logger';
const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/afis_db';
    const conn = await mongoose.connect(mongoUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err}`));
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};
export default connectDB;
EOF

# ═══════════════════════════════════════════════════════════════
# MIDDLEWARE
# ═══════════════════════════════════════════════════════════════
cat > src/middleware/auth.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/apiResponse';
import User from '../models/User';
declare global { namespace Express { interface Request { user?: JwtPayload & { _id?: string }; } } }
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) { sendError(res, 'No token provided.', 401); return; }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) { sendError(res, 'User no longer exists.', 401); return; }
    req.user = { ...decoded, _id: decoded.id };
    next();
  } catch { sendError(res, 'Invalid or expired token.', 401); }
};
EOF

cat > src/middleware/roleCheck.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';
export const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) { sendError(res, 'Authentication required.', 401); return; }
  if (!roles.includes(req.user.role)) { sendError(res, `Access denied. Required: ${roles.join(' or ')}`, 403); return; }
  next();
};
export const requireOperator = requireRole('operator');
export const requireIndustry = requireRole('industry');
export const requireAny = requireRole('industry', 'operator');
EOF

cat > src/middleware/errorHandler.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import logger from '../utils/logger';
interface AppError extends Error { statusCode?: number; code?: number; path?: string; value?: string; keyValue?: Record<string, string>; errors?: Record<string, { message: string }>; }
export const errorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error(err.message, { stack: err.stack });
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  if (err.code === 11000 && err.keyValue) { statusCode = 400; message = `${Object.keys(err.keyValue)[0]} already exists.`; }
  if (err instanceof MongooseError.ValidationError) { statusCode = 400; message = Object.values(err.errors).map((e) => e.message).join(', '); }
  if (err instanceof MongooseError.CastError) { statusCode = 400; message = `Invalid ${err.path}: ${err.value}`; }
  res.status(statusCode).json({ success: false, message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }), timestamp: new Date().toISOString() });
};
export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Route not found', timestamp: new Date().toISOString() });
};
EOF

# ═══════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════
cat > src/models/User.ts << 'EOF'
import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
export type UserRole = 'industry' | 'operator';
export interface IUser extends Document { name: string; email: string; password: string; role: UserRole; createdAt: Date; updatedAt: Date; comparePassword(p: string): Promise<boolean>; }
const UserSchema = new Schema<IUser>({
  name:     { type: String, required: true, trim: true, minlength: 2 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role:     { type: String, enum: ['industry','operator'], default: 'industry' },
}, { timestamps: true });
UserSchema.pre('save', async function (next) { if (!this.isModified('password')) return next(); this.password = await bcrypt.hash(this.password, 12); next(); });
UserSchema.methods.comparePassword = async function (p: string) { return bcrypt.compare(p, this.password); };
export default mongoose.model<IUser>('User', UserSchema);
EOF

cat > src/models/FreightRequest.ts << 'EOF'
import mongoose, { Document, Schema } from 'mongoose';
export type FreightStatus = 'pending' | 'approved' | 'rejected' | 'in-transit' | 'delivered';
export interface IFreightRequest extends Document { userId: mongoose.Types.ObjectId; commodityType: string; sourceStation: string; destinationStation: string; quantity: number; unit: string; status: FreightStatus; assignedRake?: mongoose.Types.ObjectId; assignedRoute?: mongoose.Types.ObjectId; estimatedDelivery?: Date; operatorNotes?: string; trackingEvents: Array<{ event: string; timestamp: Date; location?: string }>; createdAt: Date; updatedAt: Date; }
const FreightRequestSchema = new Schema<IFreightRequest>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  commodityType: { type: String, required: true, trim: true },
  sourceStation: { type: String, required: true, trim: true },
  destinationStation: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'tonnes', enum: ['tonnes','kg','containers'] },
  status: { type: String, enum: ['pending','approved','rejected','in-transit','delivered'], default: 'pending' },
  assignedRake: { type: Schema.Types.ObjectId, ref: 'Rake' },
  assignedRoute: { type: Schema.Types.ObjectId, ref: 'Route' },
  estimatedDelivery: Date, operatorNotes: String,
  trackingEvents: [{ event: { type: String, required: true }, timestamp: { type: Date, default: Date.now }, location: String }],
}, { timestamps: true });
FreightRequestSchema.index({ userId: 1, status: 1 }); FreightRequestSchema.index({ createdAt: -1 });
export default mongoose.model<IFreightRequest>('FreightRequest', FreightRequestSchema);
EOF

cat > src/models/Wagon.ts << 'EOF'
import mongoose, { Document, Schema } from 'mongoose';
export type WagonStatus = 'available' | 'assigned' | 'maintenance' | 'in-transit';
export type WagonType = 'flatcar' | 'boxcar' | 'tanker' | 'hopper' | 'gondola';
export interface IWagon extends Document { wagonNumber: string; wagonType: WagonType; capacity: number; currentLocation: string; status: WagonStatus; assignedRake?: mongoose.Types.ObjectId; lastMaintenanceDate?: Date; nextMaintenanceDue?: Date; locationHistory: Array<{ location: string; timestamp: Date }>; createdAt: Date; updatedAt: Date; }
const WagonSchema = new Schema<IWagon>({
  wagonNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  wagonType: { type: String, enum: ['flatcar','boxcar','tanker','hopper','gondola'], default: 'boxcar' },
  capacity: { type: Number, required: true, default: 50 },
  currentLocation: { type: String, required: true, trim: true },
  status: { type: String, enum: ['available','assigned','maintenance','in-transit'], default: 'available' },
  assignedRake: { type: Schema.Types.ObjectId, ref: 'Rake' },
  lastMaintenanceDate: Date, nextMaintenanceDue: Date,
  locationHistory: [{ location: { type: String, required: true }, timestamp: { type: Date, default: Date.now } }],
}, { timestamps: true });
WagonSchema.index({ status: 1, currentLocation: 1 });
export default mongoose.model<IWagon>('Wagon', WagonSchema);
EOF

cat > src/models/Rake.ts << 'EOF'
import mongoose, { Document, Schema } from 'mongoose';
export type RakeStatus = 'idle' | 'active' | 'maintenance' | 'en-route';
export interface IRake extends Document { rakeNumber: string; wagons: mongoose.Types.ObjectId[]; route?: mongoose.Types.ObjectId; status: RakeStatus; currentLocation: string; driver?: string; totalCapacity: number; departureTime?: Date; arrivalTime?: Date; createdAt: Date; updatedAt: Date; }
const RakeSchema = new Schema<IRake>({
  rakeNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  wagons: [{ type: Schema.Types.ObjectId, ref: 'Wagon' }],
  route: { type: Schema.Types.ObjectId, ref: 'Route' },
  status: { type: String, enum: ['idle','active','maintenance','en-route'], default: 'idle' },
  currentLocation: { type: String, default: 'Depot', trim: true },
  driver: String, totalCapacity: { type: Number, default: 0 },
  departureTime: Date, arrivalTime: Date,
}, { timestamps: true });
export default mongoose.model<IRake>('Rake', RakeSchema);
EOF

cat > src/models/Route.ts << 'EOF'
import mongoose, { Document, Schema } from 'mongoose';
export interface IRoute extends Document { source: string; destination: string; optimizedPath: Array<{ station: string; distanceFromPrevious: number; estimatedTimeMinutes: number }>; totalDistance: number; estimatedTime: number; status: 'active' | 'inactive' | 'delayed'; delayMinutes: number; trafficFactor: number; createdAt: Date; updatedAt: Date; }
const RouteSchema = new Schema<IRoute>({
  source: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  optimizedPath: [{ station: String, distanceFromPrevious: { type: Number, default: 0 }, estimatedTimeMinutes: { type: Number, default: 0 } }],
  totalDistance: { type: Number, default: 0 }, estimatedTime: { type: Number, default: 0 },
  status: { type: String, enum: ['active','inactive','delayed'], default: 'active' },
  delayMinutes: { type: Number, default: 0 }, trafficFactor: { type: Number, default: 1.0, min: 0.5, max: 3.0 },
}, { timestamps: true });
RouteSchema.index({ source: 1, destination: 1 });
export default mongoose.model<IRoute>('Route', RouteSchema);
EOF

cat > src/models/Alert.ts << 'EOF'
import mongoose, { Document, Schema } from 'mongoose';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertCategory = 'wagon' | 'route' | 'demand' | 'system' | 'maintenance';
export interface IAlert extends Document { message: string; severity: AlertSeverity; category: AlertCategory; isResolved: boolean; resolvedAt?: Date; resolvedBy?: mongoose.Types.ObjectId; relatedEntity?: string; relatedEntityId?: mongoose.Types.ObjectId; timestamp: Date; createdAt: Date; }
const AlertSchema = new Schema<IAlert>({
  message: { type: String, required: true, trim: true },
  severity: { type: String, enum: ['info','warning','critical'], default: 'info' },
  category: { type: String, enum: ['wagon','route','demand','system','maintenance'], default: 'system' },
  isResolved: { type: Boolean, default: false },
  resolvedAt: Date, resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  relatedEntity: String, relatedEntityId: Schema.Types.ObjectId,
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });
AlertSchema.index({ severity: 1, isResolved: 1 }); AlertSchema.index({ timestamp: -1 });
export default mongoose.model<IAlert>('Alert', AlertSchema);
EOF

cat > src/models/Analytics.ts << 'EOF'
import mongoose, { Document, Schema } from 'mongoose';
export interface IAnalytics extends Document { date: Date; demandData: Array<{ station: string; commodity: string; predictedDemand: number; actualDemand?: number; date: Date }>; wagonUtilization: { total: number; available: number; assigned: number; maintenance: number; utilizationRate: number }; routeEfficiency: Array<{ routeId: mongoose.Types.ObjectId; source: string; destination: string; onTimeRate: number; avgDelayMinutes: number }>; totalFreightBookings: number; approvedBookings: number; rejectedBookings: number; createdAt: Date; }
const AnalyticsSchema = new Schema<IAnalytics>({
  date: { type: Date, required: true, index: true },
  demandData: [{ station: String, commodity: String, predictedDemand: Number, actualDemand: Number, date: Date }],
  wagonUtilization: { total: { type: Number, default: 0 }, available: { type: Number, default: 0 }, assigned: { type: Number, default: 0 }, maintenance: { type: Number, default: 0 }, utilizationRate: { type: Number, default: 0 } },
  routeEfficiency: [{ routeId: Schema.Types.ObjectId, source: String, destination: String, onTimeRate: Number, avgDelayMinutes: Number }],
  totalFreightBookings: { type: Number, default: 0 }, approvedBookings: { type: Number, default: 0 }, rejectedBookings: { type: Number, default: 0 },
}, { timestamps: true });
export default mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);
EOF

# ═══════════════════════════════════════════════════════════════
# SERVICES
# ═══════════════════════════════════════════════════════════════
cat > src/services/routeOptimizationService.ts << 'EOF'
export interface GraphNode { station: string; distance: number; distanceFromPrevious: number; estimatedTimeMinutes: number; }
interface Edge { to: string; distance: number; timeMinutes: number; }
type Graph = Map<string, Edge[]>;
const RAILWAY_GRAPH: Graph = new Map([
  ['Mumbai',     [{ to:'Surat', distance:263, timeMinutes:290 }, { to:'Pune', distance:149, timeMinutes:185 }, { to:'Nashik', distance:167, timeMinutes:200 }]],
  ['Pune',       [{ to:'Mumbai', distance:149, timeMinutes:185 }, { to:'Solapur', distance:240, timeMinutes:270 }, { to:'Hyderabad', distance:558, timeMinutes:600 }]],
  ['Surat',      [{ to:'Mumbai', distance:263, timeMinutes:290 }, { to:'Ahmedabad', distance:265, timeMinutes:290 }]],
  ['Ahmedabad',  [{ to:'Surat', distance:265, timeMinutes:290 }, { to:'Jaipur', distance:575, timeMinutes:620 }]],
  ['Jaipur',     [{ to:'Ahmedabad', distance:575, timeMinutes:620 }, { to:'Delhi', distance:281, timeMinutes:310 }, { to:'Agra', distance:233, timeMinutes:260 }]],
  ['Delhi',      [{ to:'Jaipur', distance:281, timeMinutes:310 }, { to:'Agra', distance:200, timeMinutes:240 }, { to:'Lucknow', distance:497, timeMinutes:540 }, { to:'Chandigarh', distance:250, timeMinutes:280 }]],
  ['Agra',       [{ to:'Delhi', distance:200, timeMinutes:240 }, { to:'Lucknow', distance:363, timeMinutes:400 }]],
  ['Lucknow',    [{ to:'Delhi', distance:497, timeMinutes:540 }, { to:'Agra', distance:363, timeMinutes:400 }, { to:'Varanasi', distance:286, timeMinutes:320 }]],
  ['Varanasi',   [{ to:'Lucknow', distance:286, timeMinutes:320 }, { to:'Patna', distance:233, timeMinutes:260 }]],
  ['Patna',      [{ to:'Varanasi', distance:233, timeMinutes:260 }, { to:'Kolkata', distance:580, timeMinutes:620 }]],
  ['Kolkata',    [{ to:'Patna', distance:580, timeMinutes:620 }, { to:'Bhubaneswar', distance:441, timeMinutes:480 }]],
  ['Bhubaneswar',[{ to:'Kolkata', distance:441, timeMinutes:480 }, { to:'Vijayawada', distance:660, timeMinutes:720 }]],
  ['Vijayawada', [{ to:'Bhubaneswar', distance:660, timeMinutes:720 }, { to:'Hyderabad', distance:270, timeMinutes:300 }, { to:'Chennai', distance:430, timeMinutes:470 }]],
  ['Hyderabad',  [{ to:'Vijayawada', distance:270, timeMinutes:300 }, { to:'Bengaluru', distance:563, timeMinutes:610 }, { to:'Pune', distance:558, timeMinutes:600 }, { to:'Solapur', distance:302, timeMinutes:340 }]],
  ['Chennai',    [{ to:'Vijayawada', distance:430, timeMinutes:470 }, { to:'Bengaluru', distance:346, timeMinutes:380 }, { to:'Coimbatore', distance:497, timeMinutes:540 }]],
  ['Bengaluru',  [{ to:'Chennai', distance:346, timeMinutes:380 }, { to:'Hyderabad', distance:563, timeMinutes:610 }, { to:'Mysuru', distance:139, timeMinutes:160 }, { to:'Coimbatore', distance:367, timeMinutes:400 }]],
  ['Mysuru',     [{ to:'Bengaluru', distance:139, timeMinutes:160 }, { to:'Coimbatore', distance:213, timeMinutes:240 }]],
  ['Coimbatore', [{ to:'Chennai', distance:497, timeMinutes:540 }, { to:'Bengaluru', distance:367, timeMinutes:400 }, { to:'Mysuru', distance:213, timeMinutes:240 }]],
  ['Solapur',    [{ to:'Pune', distance:240, timeMinutes:270 }, { to:'Hyderabad', distance:302, timeMinutes:340 }]],
  ['Nashik',     [{ to:'Mumbai', distance:167, timeMinutes:200 }]],
  ['Chandigarh', [{ to:'Delhi', distance:250, timeMinutes:280 }]],
]);
export interface DijkstraResult { path: GraphNode[]; totalDistance: number; totalTimeMinutes: number; found: boolean; }
export const dijkstra = (source: string, destination: string): DijkstraResult => {
  if (source === destination) return { path:[{ station:source, distance:0, distanceFromPrevious:0, estimatedTimeMinutes:0 }], totalDistance:0, totalTimeMinutes:0, found:true };
  const distances = new Map<string,number>(); const times = new Map<string,number>();
  const previous = new Map<string,string|null>(); const unvisited = new Set<string>();
  for (const s of RAILWAY_GRAPH.keys()) { distances.set(s, Infinity); times.set(s, Infinity); previous.set(s, null); unvisited.add(s); }
  distances.set(source, 0); times.set(source, 0);
  while (unvisited.size > 0) {
    let current: string|null = null; let minDist = Infinity;
    for (const node of unvisited) { const d = distances.get(node) ?? Infinity; if (d < minDist) { minDist = d; current = node; } }
    if (!current || current === destination) break;
    unvisited.delete(current);
    for (const { to, distance, timeMinutes } of (RAILWAY_GRAPH.get(current) || [])) {
      if (!unvisited.has(to)) continue;
      const alt = (distances.get(current) ?? Infinity) + distance;
      if (alt < (distances.get(to) ?? Infinity)) { distances.set(to, alt); times.set(to, (times.get(current) ?? 0) + timeMinutes); previous.set(to, current); }
    }
  }
  const pathStations: string[] = []; let curr: string|null = destination;
  while (curr) { pathStations.unshift(curr); curr = previous.get(curr) ?? null; }
  if (pathStations[0] !== source) return { path:[{ station:source, distance:0, distanceFromPrevious:0, estimatedTimeMinutes:0 },{ station:destination, distance:999, distanceFromPrevious:999, estimatedTimeMinutes:720 }], totalDistance:999, totalTimeMinutes:720, found:false };
  let cum = 0;
  const path: GraphNode[] = pathStations.map((s, i) => {
    let dfp = 0, tfp = 0;
    if (i > 0) { const e = (RAILWAY_GRAPH.get(pathStations[i-1]) || []).find(x => x.to === s); dfp = e?.distance || 0; tfp = e?.timeMinutes || 0; }
    cum += dfp; return { station:s, distance:cum, distanceFromPrevious:dfp, estimatedTimeMinutes:tfp };
  });
  return { path, totalDistance: distances.get(destination) ?? 999, totalTimeMinutes: times.get(destination) ?? 720, found:true };
};
export const getAvailableStations = (): string[] => Array.from(RAILWAY_GRAPH.keys()).sort();
EOF

cat > src/services/demandPredictionService.ts << 'EOF'
export interface DemandEntry { month: string; station: string; commodity: string; actualDemand: number; predictedDemand: number; confidence: number; }
const SEASONAL: Record<string,number[]> = {
  'Coal':       [1.2,1.1,1.0,0.9,0.8,0.8,0.9,1.0,1.1,1.2,1.3,1.3],
  'Steel':      [1.0,1.0,1.1,1.1,1.2,1.2,1.0,1.0,1.1,1.1,1.0,0.9],
  'Cement':     [0.9,1.0,1.2,1.3,1.2,0.8,0.7,0.8,1.1,1.2,1.1,0.9],
  'Fertilizer': [1.3,1.2,1.4,1.5,1.3,0.9,0.8,0.9,1.2,1.4,1.3,1.2],
  'Grains':     [0.8,0.9,0.9,1.0,1.2,1.3,1.2,1.1,1.0,0.9,0.9,0.8],
  'Containers': [1.1,1.0,1.1,1.1,1.0,1.0,1.1,1.1,1.2,1.2,1.2,1.3],
};
const BASE: Record<string,number> = { Mumbai:5200, Delhi:4800, Chennai:3900, Bengaluru:3500, Kolkata:4100, Hyderabad:3200, Ahmedabad:2900, Pune:2700, Jaipur:2100, Surat:2400, Mysuru:1600, Coimbatore:1800, Lucknow:2200, Patna:1900, Varanasi:1700 };
const TREND = 0.02/12;
const linReg = (d: number[]) => { const n=d.length, xm=(n-1)/2, ym=d.reduce((s,v)=>s+v,0)/n; let num=0,den=0; for(let i=0;i<n;i++){num+=(i-xm)*(d[i]-ym);den+=(i-xm)**2;} const sl=den?num/den:0; return {slope:sl,intercept:ym-sl*xm}; };
export const predictDemand = (station: string, commodity: string, monthsAhead=3): DemandEntry[] => {
  const base=BASE[station]||2000, factors=SEASONAL[commodity]||new Array(12).fill(1.0), now=new Date();
  const hist: number[] = [];
  for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);hist.push(Math.round(base*factors[d.getMonth()]*(1+TREND*(12-i))*(0.95+Math.random()*0.1)));}
  const {slope,intercept}=linReg(hist);
  return Array.from({length:monthsAhead},(_,i)=>{
    const fd=new Date(now.getFullYear(),now.getMonth()+i+1,1), hi=hist.length+i;
    const pred=Math.round(((intercept+slope*hi)+(base*factors[fd.getMonth()]*(1+TREND*(hi+1))))/2);
    return {month:fd.toLocaleString('default',{month:'long',year:'numeric'}),station,commodity,actualDemand:0,predictedDemand:Math.max(0,pred),confidence:Math.max(60,95-i*10)};
  });
};
export const getHistoricalDemand = (station: string, commodity: string): DemandEntry[] => {
  const base=BASE[station]||2000, factors=SEASONAL[commodity]||new Array(12).fill(1.0), now=new Date();
  return Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(11-i),1);const t=1+TREND*(i+1);const actual=Math.round(base*factors[d.getMonth()]*t*(0.95+Math.random()*0.1));return {month:d.toLocaleString('default',{month:'long',year:'numeric'}),station,commodity,actualDemand:actual,predictedDemand:Math.round(base*factors[d.getMonth()]*t),confidence:90+Math.round(Math.random()*8)};});
};
export const getTopDemandStations = () => Object.entries(BASE).map(([station,totalDemand])=>({station,totalDemand})).sort((a,b)=>b.totalDemand-a.totalDemand);
EOF

cat > src/services/digitalTwinService.ts << 'EOF'
import { dijkstra } from './routeOptimizationService';
export interface SimulationStep { step:number;timestamp:string;wagonId:string;wagonNumber:string;location:string;progressPercent:number;speedKmh:number;distanceCovered:number;remainingDistance:number;status:'moving'|'stopped'|'arrived'; }
export interface SimulationResult { simulationId:string;source:string;destination:string;totalDistance:number;totalTimeMinutes:number;steps:SimulationStep[];completedAt:string;summary:{avgSpeedKmh:number;stopsCount:number;onTime:boolean}; }
const WAGONS_MOCK = [{id:'W001',number:'WGN-001'},{id:'W002',number:'WGN-002'},{id:'W003',number:'WGN-003'}];
const STEPS = 10;
export const runSimulation = (source:string, destination:string, wagonCount=3, speedMultiplier=1.0): SimulationResult => {
  const r=dijkstra(source,destination), path=r.path, totalDist=r.totalDistance, totalTime=Math.round(r.totalTimeMinutes/speedMultiplier), avgSpeed=totalDist/(totalTime/60);
  const steps:SimulationStep[]=[], wagons=WAGONS_MOCK.slice(0,Math.min(wagonCount,3)); let stops=0; const now=new Date();
  for(let i=0;i<=STEPS;i++){
    const prog=i/STEPS, dist=Math.round(totalDist*prog), rem=totalDist-dist;
    let loc=source; for(const n of path){if(n.distance<=dist)loc=n.station;}
    const stopped=i>0&&i<STEPS&&Math.random()<0.1; if(stopped)stops++;
    const ts=new Date(now.getTime()+(i*totalTime*60000)/STEPS);
    for(const w of wagons){steps.push({step:i,timestamp:ts.toISOString(),wagonId:w.id,wagonNumber:w.number,location:loc,progressPercent:Math.round(prog*100),speedKmh:stopped?0:Math.round(avgSpeed+(Math.random()-0.5)*20),distanceCovered:dist,remainingDistance:rem,status:i===STEPS?'arrived':stopped?'stopped':'moving'});}
  }
  return {simulationId:`SIM-${Date.now()}`,source,destination,totalDistance:totalDist,totalTimeMinutes:totalTime,steps,completedAt:new Date(now.getTime()+totalTime*60000).toISOString(),summary:{avgSpeedKmh:Math.round(avgSpeed),stopsCount:stops,onTime:stops<=1}};
};
EOF

# ═══════════════════════════════════════════════════════════════
# CONTROLLERS
# ═══════════════════════════════════════════════════════════════
cat > src/controllers/authController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const register = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const {name,email,password,role}=req.body;
    if(await User.findOne({email})){sendError(res,'Email already registered.',400);return;}
    const user=await User.create({name,email,password,role});
    sendSuccess(res,{token:generateToken(user),user:{id:user._id,name:user.name,email:user.email,role:user.role}},'Registration successful',201);
  } catch(e){next(e);}
};
export const login = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const {email,password}=req.body;
    const user=await User.findOne({email}).select('+password');
    if(!user||!(await user.comparePassword(password))){sendError(res,'Invalid email or password.',401);return;}
    sendSuccess(res,{token:generateToken(user),user:{id:user._id,name:user.name,email:user.email,role:user.role}},'Login successful');
  } catch(e){next(e);}
};
export const getMe = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const user=await User.findById(req.user?.id);
    if(!user){sendError(res,'User not found',404);return;}
    sendSuccess(res,{user:{id:user._id,name:user.name,email:user.email,role:user.role}});
  } catch(e){next(e);}
};
EOF

cat > src/controllers/freightController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import FreightRequest from '../models/FreightRequest';
import Alert from '../models/Alert';
import Wagon from '../models/Wagon';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const bookFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const {commodityType,sourceStation,destinationStation,quantity,unit}=req.body;
    const avail=await Wagon.countDocuments({status:'available'});
    if(avail===0){await Alert.create({message:`No wagons available for booking from ${sourceStation} to ${destinationStation}`,severity:'critical',category:'wagon'});}
    const freight=await FreightRequest.create({userId:req.user?.id,commodityType,sourceStation,destinationStation,quantity,unit:unit||'tonnes',trackingEvents:[{event:'Booking created',timestamp:new Date(),location:sourceStation}]});
    sendSuccess(res,{freight},'Freight booking submitted',201);
  } catch(e){next(e);}
};
export const getMyRequests = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const page=parseInt(req.query.page as string)||1, limit=parseInt(req.query.limit as string)||10, skip=(page-1)*limit;
    const [requests,total]=await Promise.all([FreightRequest.find({userId:req.user?.id}).populate('assignedRake','rakeNumber status currentLocation').populate('assignedRoute','source destination estimatedTime').sort({createdAt:-1}).skip(skip).limit(limit),FreightRequest.countDocuments({userId:req.user?.id})]);
    sendSuccess(res,{requests,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(e){next(e);}
};
export const trackFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const freight=await FreightRequest.findById(req.params.id).populate('assignedRake','rakeNumber status currentLocation').populate('assignedRoute','source destination optimizedPath estimatedTime').populate('userId','name email');
    if(!freight){sendError(res,'Freight request not found',404);return;}
    if(req.user?.role==='industry'&&freight.userId.toString()!==req.user?.id){sendError(res,'Unauthorized',403);return;}
    sendSuccess(res,{freight});
  } catch(e){next(e);}
};
export const getAllFreightRequests = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const page=parseInt(req.query.page as string)||1, limit=parseInt(req.query.limit as string)||20, skip=(page-1)*limit;
    const query: Record<string,unknown>={};
    if(req.query.status)query.status=req.query.status;
    const [requests,total]=await Promise.all([FreightRequest.find(query).populate('userId','name email').populate('assignedRake','rakeNumber').sort({createdAt:-1}).skip(skip).limit(limit),FreightRequest.countDocuments(query)]);
    sendSuccess(res,{requests,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(e){next(e);}
};
export const approveFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const freight=await FreightRequest.findById(req.params.id);
    if(!freight){sendError(res,'Not found',404);return;}
    if(freight.status!=='pending'){sendError(res,`Cannot approve status: ${freight.status}`,400);return;}
    freight.status='approved'; freight.operatorNotes=req.body.operatorNotes;
    if(req.body.estimatedDelivery)freight.estimatedDelivery=new Date(req.body.estimatedDelivery);
    freight.trackingEvents.push({event:'Approved by operator',timestamp:new Date(),location:freight.sourceStation});
    await freight.save();
    sendSuccess(res,{freight},'Approved successfully');
  } catch(e){next(e);}
};
export const rejectFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const freight=await FreightRequest.findById(req.params.id);
    if(!freight){sendError(res,'Not found',404);return;}
    if(freight.status!=='pending'){sendError(res,`Cannot reject status: ${freight.status}`,400);return;}
    freight.status='rejected'; freight.operatorNotes=req.body.operatorNotes||'Rejected by operator';
    freight.trackingEvents.push({event:'Rejected by operator',timestamp:new Date()});
    await freight.save();
    sendSuccess(res,{freight},'Rejected');
  } catch(e){next(e);}
};
EOF

cat > src/controllers/wagonController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Wagon from '../models/Wagon';
import Alert from '../models/Alert';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const getAllWagons = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const query: Record<string,unknown>={};
    if(req.query.status)query.status=req.query.status;
    if(req.query.location)query.currentLocation=new RegExp(req.query.location as string,'i');
    const wagons=await Wagon.find(query).populate('assignedRake','rakeNumber status').sort({wagonNumber:1});
    const [total,available,assigned,maintenance]= await Promise.all([Wagon.countDocuments(),Wagon.countDocuments({status:'available'}),Wagon.countDocuments({status:'assigned'}),Wagon.countDocuments({status:'maintenance'})]);
    sendSuccess(res,{wagons,summary:{total,available,assigned,maintenance,inTransit:total-available-assigned-maintenance}});
  } catch(e){next(e);}
};
export const createWagon = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const wagon=await Wagon.create(req.body);
    sendSuccess(res,{wagon},'Wagon created',201);
  } catch(e){next(e);}
};
export const updateWagonLocation = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const wagon=await Wagon.findById(req.params.id);
    if(!wagon){sendError(res,'Wagon not found',404);return;}
    wagon.locationHistory.push({location:wagon.currentLocation,timestamp:new Date()});
    wagon.currentLocation=req.body.location;
    if(req.body.status)wagon.status=req.body.status;
    await wagon.save();
    if(req.body.status==='maintenance'){await Alert.create({message:`Wagon ${wagon.wagonNumber} moved to maintenance at ${req.body.location}`,severity:'warning',category:'maintenance',relatedEntity:'Wagon',relatedEntityId:wagon._id});}
    sendSuccess(res,{wagon},'Location updated');
  } catch(e){next(e);}
};
EOF

cat > src/controllers/rakeController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Rake from '../models/Rake';
import Wagon from '../models/Wagon';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const createRake = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    if(await Rake.findOne({rakeNumber:req.body.rakeNumber})){sendError(res,'Rake number already exists',400);return;}
    const rake=await Rake.create(req.body);
    sendSuccess(res,{rake},'Rake created',201);
  } catch(e){next(e);}
};
export const getAllRakes = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const rakes=await Rake.find().populate('wagons','wagonNumber wagonType status capacity currentLocation').populate('route','source destination estimatedTime status').sort({createdAt:-1});
    sendSuccess(res,{rakes,total:rakes.length});
  } catch(e){next(e);}
};
export const assignWagonsToRake = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const {rakeId,wagonIds}=req.body;
    const rake=await Rake.findById(rakeId); if(!rake){sendError(res,'Rake not found',404);return;}
    const wagons=await Wagon.find({_id:{$in:wagonIds},status:'available'});
    if(wagons.length!==wagonIds.length){sendError(res,'Some wagons are not available',400);return;}
    await Wagon.updateMany({_id:{$in:wagonIds}},{status:'assigned',assignedRake:rake._id});
    rake.wagons=[...rake.wagons,...wagonIds]; rake.totalCapacity=wagons.reduce((s,w)=>s+w.capacity,rake.totalCapacity); rake.status='active';
    await rake.save();
    const updated=await Rake.findById(rakeId).populate('wagons','wagonNumber wagonType status capacity');
    sendSuccess(res,{rake:updated},`${wagons.length} wagon(s) assigned`);
  } catch(e){next(e);}
};
EOF

cat > src/controllers/routeController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import Route from '../models/Route';
import Alert from '../models/Alert';
import { dijkstra, getAvailableStations } from '../services/routeOptimizationService';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const optimizeRoute = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const {source,destination,trafficFactor}=req.body;
    if(!source||!destination){sendError(res,'Source and destination required',400);return;}
    const result=dijkstra(source,destination), tF=trafficFactor||1.0, adjTime=Math.round(result.totalTimeMinutes*tF);
    const route=await Route.findOneAndUpdate({source,destination},{source,destination,optimizedPath:result.path,totalDistance:result.totalDistance,estimatedTime:adjTime,trafficFactor:tF,status:'active',delayMinutes:Math.round((tF-1.0)*result.totalTimeMinutes)},{upsert:true,new:true});
    if(tF>1.5){await Alert.create({message:`Route delay: ${source}→${destination}. Factor: ${tF}x. Delay: ${route.delayMinutes} min`,severity:'warning',category:'route',relatedEntity:'Route',relatedEntityId:route._id});}
    sendSuccess(res,{route,optimization:{pathFound:result.found,stops:result.path.length,totalDistance:result.totalDistance,estimatedTimeHours:(adjTime/60).toFixed(1)}},'Route optimized');
  } catch(e){next(e);}
};
export const getAllRoutes = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try { const routes=await Route.find().sort({createdAt:-1}); sendSuccess(res,{routes,availableStations:getAvailableStations()}); }
  catch(e){next(e);}
};
EOF

cat > src/controllers/simulationController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { runSimulation } from '../services/digitalTwinService';
import { sendSuccess, sendError } from '../utils/apiResponse';
const store=new Map<string,{status:string;result:unknown;startedAt:Date}>();
export const runSimulationController = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const {source,destination,wagonCount,speedMultiplier}=req.body;
    if(!source||!destination){sendError(res,'Source and destination required',400);return;}
    const result=runSimulation(source,destination,wagonCount||3,speedMultiplier||1.0);
    store.set(result.simulationId,{status:'completed',result,startedAt:new Date()});
    sendSuccess(res,{simulation:result},'Simulation completed');
  } catch(e){next(e);}
};
export const getSimulationStatus = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const {id}=req.params;
    if(id&&store.has(id)){sendSuccess(res,store.get(id)!);return;}
    sendSuccess(res,{simulations:Array.from(store.entries()).map(([k,v])=>({simulationId:k,...v})).slice(-10),totalRun:store.size});
  } catch(e){next(e);}
};
EOF

cat > src/controllers/demandController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { predictDemand, getHistoricalDemand, getTopDemandStations } from '../services/demandPredictionService';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const getDemandPrediction = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const station=(req.query.station as string)||'Mumbai', commodity=(req.query.commodity as string)||'Coal', monthsAhead=parseInt(req.query.monthsAhead as string)||3;
    if(monthsAhead>12){sendError(res,'monthsAhead cannot exceed 12',400);return;}
    sendSuccess(res,{predictions:predictDemand(station,commodity,monthsAhead),historical:getHistoricalDemand(station,commodity),topStations:getTopDemandStations(),meta:{station,commodity,monthsAhead}});
  } catch(e){next(e);}
};
export const trainDemandModel = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const {station,commodity}=req.body;
    if(!station||!commodity){sendError(res,'station and commodity required',400);return;}
    sendSuccess(res,{model:{station,commodity,trainedAt:new Date().toISOString(),accuracy:(82+Math.random()*12).toFixed(2),trainingDataPoints:req.body.historicalData?.length||12,algorithm:'Linear Regression with Seasonal Decomposition',status:'trained'}},'Model trained');
  } catch(e){next(e);}
};
EOF

cat > src/controllers/analyticsController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import FreightRequest from '../models/FreightRequest';
import Wagon from '../models/Wagon';
import Route from '../models/Route';
import Alert from '../models/Alert';
import { sendSuccess } from '../utils/apiResponse';
export const getDashboardAnalytics = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const now=new Date(), d30=new Date(now.getTime()-30*24*60*60*1000), d7=new Date(now.getTime()-7*24*60*60*1000);
    const [fStats,wStats,rStats,aStats,monthly,weekly]=await Promise.all([
      FreightRequest.aggregate([{$group:{_id:'$status',count:{$sum:1}}}]),
      Wagon.aggregate([{$group:{_id:'$status',count:{$sum:1}}}]),
      Route.aggregate([{$group:{_id:'$status',count:{$sum:1},avgDelay:{$avg:'$delayMinutes'}}}]),
      Alert.aggregate([{$match:{isResolved:false}},{$group:{_id:'$severity',count:{$sum:1}}}]),
      FreightRequest.aggregate([{$match:{createdAt:{$gte:d30}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},bookings:{$sum:1},approved:{$sum:{$cond:[{$eq:['$status','approved']},1,0]}}}},{$sort:{_id:1}}]),
      FreightRequest.aggregate([{$match:{createdAt:{$gte:d7}}},{$group:{_id:'$commodityType',count:{$sum:1},totalQuantity:{$sum:'$quantity'}}},{$sort:{totalQuantity:-1}},{$limit:5}]),
    ]);
    const wMap=Object.fromEntries(wStats.map((w:any)=>[w._id,w.count]));
    const fMap=Object.fromEntries(fStats.map((f:any)=>[f._id,f.count]));
    const aMap=Object.fromEntries(aStats.map((a:any)=>[a._id,a.count]));
    const total=Object.values(wMap).reduce((a:number,b)=>a+(b as number),0) as number;
    const assigned=((wMap['assigned']||0) as number)+((wMap['in-transit']||0) as number);
    const totalF=Object.values(fMap).reduce((a:number,b)=>a+(b as number),0) as number;
    sendSuccess(res,{kpi:{totalFreightRequests:totalF,pendingApprovals:fMap['pending']||0,activeShipments:fMap['in-transit']||0,deliveredThisMonth:fMap['delivered']||0,wagonUtilizationRate:total>0?((assigned/total)*100).toFixed(1):'0.0',totalWagons:total,activeAlerts:Object.values(aMap).reduce((a:number,b)=>a+(b as number),0),criticalAlerts:aMap['critical']||0},freightStatusBreakdown:fStats,wagonUtilization:{...wMap,utilizationRate:total>0?((assigned/total)*100).toFixed(1):'0.0'},routeStats:rStats,alertSeverityBreakdown:aStats,monthlyTrend:monthly,topCommodities:weekly});
  } catch(e){next(e);}
};
EOF

cat > src/controllers/alertController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Alert from '../models/Alert';
import Wagon from '../models/Wagon';
import Route from '../models/Route';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const getAlerts = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const query: Record<string,unknown>={isResolved:req.query.resolved==='true'};
    if(req.query.severity)query.severity=req.query.severity;
    if(req.query.category)query.category=req.query.category;
    const alerts=await Alert.find(query).sort({timestamp:-1}).limit(parseInt(req.query.limit as string)||50);
    sendSuccess(res,{alerts,summary:{total:alerts.length,critical:alerts.filter(a=>a.severity==='critical').length,warning:alerts.filter(a=>a.severity==='warning').length,info:alerts.filter(a=>a.severity==='info').length}});
  } catch(e){next(e);}
};
export const createAlert = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const alert=await Alert.create(req.body);
    sendSuccess(res,{alert},'Alert created',201);
  } catch(e){next(e);}
};
export const resolveAlert = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const alert=await Alert.findByIdAndUpdate(req.params.id,{isResolved:true,resolvedAt:new Date(),resolvedBy:req.user?.id},{new:true});
    if(!alert){sendError(res,'Alert not found',404);return;}
    sendSuccess(res,{alert},'Alert resolved');
  } catch(e){next(e);}
};
export const checkAndGenerateAlerts = async (): Promise<void> => {
  try {
    const avail=await Wagon.countDocuments({status:'available'});
    if(avail===0){const ex=await Alert.findOne({message:/No wagons available/,isResolved:false,createdAt:{$gte:new Date(Date.now()-3600000)}});if(!ex)await Alert.create({message:'No wagons available in network.',severity:'critical',category:'wagon'});}
    else if(avail<3){await Alert.create({message:`Critical shortage: only ${avail} wagon(s) available.`,severity:'warning',category:'wagon'});}
    const delayed=await Route.find({delayMinutes:{$gt:30}});
    for(const r of delayed){const ex=await Alert.findOne({relatedEntityId:r._id,isResolved:false,createdAt:{$gte:new Date(Date.now()-7200000)}});if(!ex)await Alert.create({message:`Route delay: ${r.source}→${r.destination}. ${r.delayMinutes} min`,severity:r.delayMinutes>60?'critical':'warning',category:'route',relatedEntity:'Route',relatedEntityId:r._id});}
  } catch(err){console.error('Alert check error:',err);}
};
EOF

cat > src/controllers/aiController.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import FreightRequest from '../models/FreightRequest';
import Wagon from '../models/Wagon';
import Route from '../models/Route';
import Alert from '../models/Alert';
import { dijkstra } from '../services/routeOptimizationService';
import { predictDemand } from '../services/demandPredictionService';
import { sendSuccess, sendError } from '../utils/apiResponse';
export interface AIRecommendation { id:string;type:string;title:string;description:string;priority:'low'|'medium'|'high'|'critical';action:string;estimatedImpact:string;data:unknown; }
export const getAIRecommendations = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const recs: AIRecommendation[]=[];
    const delayed=await Route.find({delayMinutes:{$gt:20}}).limit(3);
    for(const r of delayed){const re=dijkstra(r.source,r.destination);recs.push({id:`REC-RT-${r._id}`,type:'route_optimization',title:`Optimize: ${r.source}→${r.destination}`,description:`${r.delayMinutes}-min delay detected. AI suggests rerouting.`,priority:r.delayMinutes>60?'critical':'high',action:'REROUTE',estimatedImpact:`Save ~${Math.round(r.delayMinutes*0.7)} min`,data:{routeId:r._id,currentDelay:r.delayMinutes,suggestedPath:re.path}});}
    const pending=await FreightRequest.countDocuments({status:'pending'});
    if(pending>5)recs.push({id:`REC-AP-${Date.now()}`,type:'approval_backlog',title:`${pending} Requests Awaiting Approval`,description:'Large backlog detected. AI recommends batch processing.',priority:pending>20?'critical':'medium',action:'BATCH_APPROVE',estimatedImpact:`Unblock ${pending} users`,data:{pendingCount:pending}});
    for(const station of['Mumbai','Delhi','Chennai']){const p=predictDemand(station,'Coal',1);if(p[0]&&p[0].predictedDemand>5000)recs.push({id:`REC-DM-${station}`,type:'demand_surge',title:`Demand Surge: ${station}`,description:`${p[0].predictedDemand.toLocaleString()} tonnes predicted next month.`,priority:'medium',action:'PRE_POSITION_RAKES',estimatedImpact:'Prevent freight backlog',data:p[0]});}
    recs.sort((a,b)=>({critical:0,high:1,medium:2,low:3}[a.priority]-{critical:0,high:1,medium:2,low:3}[b.priority]));
    sendSuccess(res,{recommendations:recs,total:recs.length,generatedAt:new Date().toISOString()});
  } catch(e){next(e);}
};
export const executeAIAction = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const {action,recommendationId,params}=req.body;
    if(!action){sendError(res,'Action required',400);return;}
    let result: unknown;
    if(action==='BATCH_APPROVE'){const r=await FreightRequest.updateMany({status:'pending'},{status:'approved',operatorNotes:'Auto-approved by AI',$push:{trackingEvents:{event:'Auto-approved by AI',timestamp:new Date()}}});result={modifiedCount:r.modifiedCount};}
    else if(action==='SCHEDULE_MAINTENANCE'){const r=await Wagon.updateMany({_id:{$in:params?.wagonIds||[]}},{status:'maintenance'});result={scheduledCount:r.modifiedCount};}
    else if(action==='REROUTE'){if(params?.routeId)await Route.findByIdAndUpdate(params.routeId,{delayMinutes:0,trafficFactor:1.0});result={rerouteApplied:true};}
    else{sendError(res,`Unknown action: ${action}`,400);return;}
    sendSuccess(res,{executedAction:action,recommendationId,result,executedAt:new Date().toISOString()},`Action '${action}' executed`);
  } catch(e){next(e);}
};
EOF

# ═══════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════
cat > src/routes/authRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
const router = Router();
router.post('/register',[body('name').trim().isLength({min:2}),body('email').isEmail().normalizeEmail(),body('password').isLength({min:6}),body('role').optional().isIn(['industry','operator'])],register);
router.post('/login',[body('email').isEmail().normalizeEmail(),body('password').notEmpty()],login);
router.get('/me',authenticate,getMe);
export default router;
EOF

cat > src/routes/freightRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { bookFreight, getMyRequests, trackFreight, getAllFreightRequests, approveFreight, rejectFreight } from '../controllers/freightController';
import { authenticate } from '../middleware/auth';
import { requireOperator, requireAny } from '../middleware/roleCheck';
const router = Router();
router.post('/book',authenticate,requireAny,[body('commodityType').notEmpty(),body('sourceStation').notEmpty(),body('destinationStation').notEmpty(),body('quantity').isNumeric().isFloat({min:1})],bookFreight);
router.get('/my-requests',authenticate,requireAny,getMyRequests);
router.get('/track/:id',authenticate,requireAny,trackFreight);
router.get('/all',authenticate,requireOperator,getAllFreightRequests);
router.put('/approve/:id',authenticate,requireOperator,approveFreight);
router.put('/reject/:id',authenticate,requireOperator,rejectFreight);
export default router;
EOF

cat > src/routes/wagonRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { getAllWagons, createWagon, updateWagonLocation } from '../controllers/wagonController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/',authenticate,getAllWagons);
router.post('/',authenticate,requireOperator,[body('wagonNumber').notEmpty(),body('currentLocation').notEmpty()],createWagon);
router.put('/:id/location',authenticate,requireOperator,[body('location').notEmpty()],updateWagonLocation);
export default router;
EOF

cat > src/routes/rakeRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { createRake, getAllRakes, assignWagonsToRake } from '../controllers/rakeController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/',authenticate,getAllRakes);
router.post('/create',authenticate,requireOperator,[body('rakeNumber').notEmpty()],createRake);
router.put('/assign-wagons',authenticate,requireOperator,[body('rakeId').notEmpty(),body('wagonIds').isArray({min:1})],assignWagonsToRake);
export default router;
EOF

cat > src/routes/routeRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { optimizeRoute, getAllRoutes } from '../controllers/routeController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/',authenticate,getAllRoutes);
router.post('/optimize',authenticate,requireOperator,[body('source').notEmpty(),body('destination').notEmpty()],optimizeRoute);
export default router;
EOF

cat > src/routes/simulationRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { runSimulationController, getSimulationStatus } from '../controllers/simulationController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.post('/run',authenticate,requireOperator,[body('source').notEmpty(),body('destination').notEmpty()],runSimulationController);
router.get('/status',authenticate,getSimulationStatus);
router.get('/status/:id',authenticate,getSimulationStatus);
export default router;
EOF

cat > src/routes/demandRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { getDemandPrediction, trainDemandModel } from '../controllers/demandController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/predict',authenticate,getDemandPrediction);
router.post('/train-model',authenticate,requireOperator,[body('station').notEmpty(),body('commodity').notEmpty()],trainDemandModel);
export default router;
EOF

cat > src/routes/analyticsRoutes.ts << 'EOF'
import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/dashboard',authenticate,requireOperator,getDashboardAnalytics);
export default router;
EOF

cat > src/routes/alertRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { getAlerts, createAlert, resolveAlert } from '../controllers/alertController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/',authenticate,getAlerts);
router.post('/',authenticate,requireOperator,[body('message').notEmpty()],createAlert);
router.put('/:id/resolve',authenticate,requireOperator,resolveAlert);
export default router;
EOF

cat > src/routes/aiRoutes.ts << 'EOF'
import { Router } from 'express';
import { body } from 'express-validator';
import { getAIRecommendations, executeAIAction } from '../controllers/aiController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/recommendations',authenticate,getAIRecommendations);
router.post('/execute-action',authenticate,requireOperator,[body('action').notEmpty()],executeAIAction);
export default router;
EOF

# ═══════════════════════════════════════════════════════════════
# VERIFY
# ═══════════════════════════════════════════════════════════════
echo ""
echo "✅ All files created!"
echo ""
echo "📁 Structure:"
find src -name "*.ts" | sort
echo ""
echo "▶  Now run: npm run dev"








