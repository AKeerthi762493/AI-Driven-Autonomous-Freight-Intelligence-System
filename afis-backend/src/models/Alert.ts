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
