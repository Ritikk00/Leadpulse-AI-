import mongoose from 'mongoose';

const leadActivitySchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['created', 'status_changed', 'updated', 'ai_analyzed', 'ai_analysis_failed', 'assigned', 'note', 'whatsapp', 'webhook'], required: true },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

leadActivitySchema.index({ lead: 1, createdAt: -1 });

export default mongoose.model('LeadActivity', leadActivitySchema);