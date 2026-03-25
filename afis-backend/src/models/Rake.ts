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
