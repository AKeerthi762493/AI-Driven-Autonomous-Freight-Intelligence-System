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
