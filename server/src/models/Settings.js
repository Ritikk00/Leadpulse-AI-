import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  autoAssign: { type: Boolean, default: false },
  lastAssignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
