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
