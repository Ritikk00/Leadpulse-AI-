import mongoose from 'mongoose';

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'LOST'];
export const LEAD_PRIORITIES = ['HOT', 'WARM', 'COLD'];

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: '' },
  source: { type: String, trim: true, maxlength: 80, default: 'Website' },
  requirement: { type: String, required: true },
  timeline: { type: String, enum: ['Immediate (Ready now)', 'Within 15 - 30 Days', 'Exploring / General Inquiry'], default: 'Immediate (Ready now)' },
  status: { type: String, enum: LEAD_STATUSES, default: 'NEW', index: true },
  priority: { type: String, enum: LEAD_PRIORITIES, default: 'WARM', index: true },
  aiScore: { type: Number, min: 0, max: 100, default: 50 },
  detectedBudget: { type: String, default: 'Not Specified' },
  aiSummary: { type: String, maxlength: 1000, default: '' },
  suggestedWhatsAppMessage: { type: String, default: '' },
  lastContactedAt: { type: Date, default: null },
  followUpCount: { type: Number, min: 0, default: 0 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  trackingCodeHash: { type: String, select: false, unique: true, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

leadSchema.index({ createdAt: -1 });
leadSchema.index({ assignedTo: 1, createdAt: -1 });
leadSchema.index({ email: 1, createdAt: -1 });
leadSchema.index({ status: 1, priority: 1 });
leadSchema.index({ name: 'text', email: 'text', phone: 'text', requirement: 'text' });

export default mongoose.model('Lead', leadSchema);