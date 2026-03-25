import mongoose, { Document, Schema } from 'mongoose';

export type WagonStatus = 'available' | 'assigned' | 'maintenance' | 'in-transit';
export type WagonType = 'flatcar' | 'boxcar' | 'tanker' | 'hopper' | 'gondola';

export interface IWagon extends Document {
  wagonNumber: string; wagonType: WagonType; capacity: number;
  currentLocation: string; status: WagonStatus;
  assignedRake?: mongoose.Types.ObjectId; lastMaintenanceDate?: Date; nextMaintenanceDue?: Date;
  locationHistory: Array<{ location: string; timestamp: Date }>;
  createdAt: Date; updatedAt: Date;
}

const WagonSchema = new Schema<IWagon>({
  wagonNumber:        { type: String, required: true, unique: true, uppercase: true, trim: true },
  wagonType:          { type: String, enum: ['flatcar','boxcar','tanker','hopper','gondola'], default: 'boxcar' },
  capacity:           { type: Number, required: true, default: 50 },
  currentLocation:    { type: String, required: true, trim: true },
  status:             { type: String, enum: ['available','assigned','maintenance','in-transit'], default: 'available' },
  assignedRake:       { type: Schema.Types.ObjectId, ref: 'Rake' },
  lastMaintenanceDate:  Date,
  nextMaintenanceDue:   Date,
  locationHistory: [{ location: { type: String, required: true }, timestamp: { type: Date, default: Date.now } }],
}, { timestamps: true });

WagonSchema.index({ status: 1, currentLocation: 1 });
export default mongoose.model<IWagon>('Wagon', WagonSchema);
