import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
  settings: {
    adminNotifications: { type: Boolean, default: true },
    acknowledgementEnabled: { type: Boolean, default: false }
  },
  refreshTokenHash: { type: String, select: false, default: null },
  tokenVersion: { type: Number, select: false, default: 0 },
  resetTokenHash: { type: String, select: false, default: null },
  resetTokenExpiresAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('User', userSchema);