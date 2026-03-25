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
