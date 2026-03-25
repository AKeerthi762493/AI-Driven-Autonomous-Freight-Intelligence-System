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
