import { createHash, randomBytes } from 'node:crypto';
import Lead, { LEAD_PRIORITIES, LEAD_STATUSES } from '../models/Lead.js';
import LeadActivity from '../models/LeadActivity.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { analyzeLead } from '../services/aiService.js';
import { sendLeadNotifications, sendFollowUp } from '../services/emailService.js';
import { env } from '../config/env.js';

const responseLead = (lead) => lead.toObject ? lead.toObject() : lead;

function leadScope(user) {
  if (user?.role === 'admin') return {};
  if (!user) return {};
  return { assignedTo: user._id };
}

function leadQuery(user, id) {
  const scope = leadScope(user);
  if (!id) return scope;
  return Object.keys(scope).length ? { $and: [{ _id: id }, scope] } : { _id: id };
}

function applyAiResult(lead, result) {
  lead.aiScore = result.score;
  lead.priority = result.priority;
  lead.detectedBudget = result.detectedBudget;
  lead.aiSummary = result.summary;
  lead.suggestedWhatsAppMessage = result.suggestedWhatsAppMessage;
}

async function recordAutomaticQualificationFailure(lead, error) {
  console.error(`Automatic AI qualification failed for lead ${lead.id}:`, error instanceof Error ? error.message : String(error));
  try {
    await activity(lead, null, 'ai_analysis_failed', 'Automatic AI qualification failed; retry from lead details.');
  } catch (activityError) {
    console.error(`Could not record AI qualification failure for lead ${lead.id}:`, activityError instanceof Error ? activityError.message : String(activityError));
  }
}

async function automaticallyQualify(lead) {
  let result;
  try {
    result = await analyzeLead(lead);
  } catch (error) {
    await recordAutomaticQualificationFailure(lead, error);
    return;
  }

  try {
    applyAiResult(lead, result);
    await lead.save();
  } catch (error) {
    await recordAutomaticQualificationFailure(lead, error);
    return;
  }

  try {
    await activity(lead, null, 'ai_analyzed', 'AI Qualification completed automatically', { score: result.score, priority: result.priority });
  } catch (error) {
    console.error(`Could not record AI qualification completion for lead ${lead.id}:`, error instanceof Error ? error.message : String(error));
  }
}

function scheduleAutomaticQualification(lead) {
  setImmediate(() => {
    automaticallyQualify(lead).catch((error) => {
      console.error(`Unexpected AI qualification failure for lead ${lead.id}:`, error instanceof Error ? error.message : String(error));
    });
  });
}

async function activity(lead, actor, type, message, metadata = {}) {
  return LeadActivity.create({ lead: lead._id, actor: actor || null, type, message, metadata });
}

async function notificationSettings(userId) {
  const user = userId
    ? await User.findById(userId).select('settings')
    : await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('settings');
  return user?.settings || { acknowledgementEnabled: env.LEAD_ACKNOWLEDGEMENT_ENABLED === 'true' };
}

async function leadOwnerId(user) {
  if (user?._id) return user._id;
  const owner = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id');
  return owner?._id || null;
}

async function autoAssignedEmployee() {
  const employees = await User.find({ role: 'employee', status: { $ne: 'inactive' } })
    .sort({ createdAt: 1 })
    .select('_id name')
    .lean();
  if (!employees.length) return null;

  while (true) {
    const settings = await Settings.findOne({ _id: 'global', autoAssign: true }).select('lastAssignedTo').lean();
    if (!settings) return null;
    const previousEmployeeId = settings.lastAssignedTo || null;
    const previousIndex = employees.findIndex(({ _id }) => String(_id) === String(previousEmployeeId));
    const nextEmployee = employees[previousIndex < 0 ? 0 : (previousIndex + 1) % employees.length];
    const updated = await Settings.findOneAndUpdate(
      { _id: 'global', autoAssign: true, lastAssignedTo: previousEmployeeId },
      { $set: { lastAssignedTo: nextEmployee._id } },
      { new: true }
    ).select('_id');
    if (updated) return nextEmployee;
  }
}

export async function createLead(req, res) {
  const ownerId = req.user._id;
  const lead = await Lead.create({
    ...req.validatedBody,
    ownerId,
    assignedTo: req.user.role === 'employee' ? req.user._id : null,
    createdBy: req.user._id
  });
  await activity(lead, req.user?._id, 'created', 'Lead created', { source: lead.source });
  sendLeadNotifications(lead, await notificationSettings(req.user?._id)).catch((error) => console.error('Lead email notification failed:', error.message));
  res.status(201).json({ success: true, data: { lead: responseLead(lead) } });
}

export async function inquireLead(req, res) {
  const trackingReference = randomBytes(32).toString('base64url');
  const result = await analyzeLead(req.validatedBody);
  const assignedEmployee = await autoAssignedEmployee();
  const lead = await Lead.create({
    ...req.validatedBody,
    aiScore: result.score,
    priority: result.priority,
    detectedBudget: result.detectedBudget,
    aiSummary: result.summary,
    suggestedWhatsAppMessage: result.suggestedWhatsAppMessage,
    ownerId: await leadOwnerId(null),
    assignedTo: assignedEmployee?._id || null,
    trackingCodeHash: createHash('sha256').update(trackingReference).digest('hex')
  });
  await activity(lead, null, 'created', 'Lead created', { source: lead.source });
  if (assignedEmployee) {
    await activity(lead, null, 'assigned', `Auto-assigned to ${assignedEmployee.name} via Round-Robin`, { assignedTo: assignedEmployee._id });
  }
  await activity(lead, null, 'ai_analyzed', 'AI qualification completed', { score: result.score, priority: result.priority });
  sendLeadNotifications(lead, await notificationSettings(null)).catch((error) => console.error('Lead email notification failed:', error.message));
  const savedLead = responseLead(lead);
  delete savedLead.trackingCodeHash;
  res.status(201).json({ success: true, data: { lead: savedLead, trackingReference } });
}

export async function trackLead(req, res) {
  const trackingCodeHash = createHash('sha256').update(req.validatedQuery.reference).digest('hex');
  const lead = await Lead.findOne({ trackingCodeHash }).select('name requirement status createdAt updatedAt');
  if (!lead) throw new AppError(404, 'No inquiry was found for that tracking reference.');
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { lead } });
}

export async function assignLead(req, res) {
  const employee = req.validatedBody.employeeId
    ? await User.findOne({ _id: req.validatedBody.employeeId, role: 'employee' }).select('_id')
    : null;
  if (req.validatedBody.employeeId && !employee) throw new AppError(404, 'Employee not found.');
  const lead = await Lead.findByIdAndUpdate(req.params.id, { $set: { assignedTo: employee?._id || null } }, { new: true, runValidators: true }).populate('assignedTo', 'name email');
  if (!lead) throw new AppError(404, 'Lead not found.');
  await activity(lead, req.user._id, 'assigned', employee ? 'Lead assigned to an employee' : 'Lead returned to the unassigned queue', { assignedTo: employee?._id || null });
  res.json({ success: true, data: { lead } });
}

export async function listLeads(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const filter = leadScope(req.user);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.source) filter.source = req.query.source;
  if (req.query.followUpDue === 'true') {
    filter.status = 'CONTACTED';
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ lastContactedAt: null }, { lastContactedAt: { $lte: new Date(Date.now() - 48 * 60 * 60 * 1000) } }] }
    ];
  }
  if (req.query.search) {
    const safeSearch = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'email', 'phone', 'requirement'].map((field) => ({ [field]: { $regex: safeSearch, $options: 'i' } }));
  }
  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('assignedTo', 'name email'),
    Lead.countDocuments(filter)
  ]);
  res.json({ success: true, data: { leads, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
}

export async function getLead(req, res) {
  const lead = await Lead.findOne(leadQuery(req.user, req.params.id)).populate('assignedTo', 'name email');
  if (!lead) throw new AppError(404, 'Lead not found.');
  const activities = await LeadActivity.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(100).populate('actor', 'name');
  res.json({ success: true, data: { lead, activities } });
}

export async function updateLead(req, res) {
  const lead = await Lead.findOne(leadQuery(req.user, req.params.id));
  if (!lead) throw new AppError(404, 'Lead not found.');
  const previousStatus = lead.status;
  Object.assign(lead, req.validatedBody);
  await lead.save();
  if (req.validatedBody.status && previousStatus !== lead.status) {
    await activity(lead, req.user._id, 'status_changed', `Status changed from ${previousStatus} to ${lead.status}`, { from: previousStatus, to: lead.status });
  } else {
    await activity(lead, req.user._id, 'updated', 'Lead details updated', { fields: Object.keys(req.validatedBody) });
  }
  res.json({ success: true, data: { lead } });
}

export async function deleteLead(req, res) {
  const lead = await Lead.findOneAndDelete(leadQuery(req.user, req.params.id));
  if (!lead) throw new AppError(404, 'Lead not found.');
  await LeadActivity.deleteMany({ lead: lead._id });
  res.json({ success: true, data: { message: 'Lead deleted.' } });
}

export async function analyzeLeadById(req, res) {
  const lead = await Lead.findOne(leadQuery(req.user, req.params.id || req.body.leadId));
  if (!lead) throw new AppError(404, 'Lead not found.');
  const result = await analyzeLead(lead);
  applyAiResult(lead, result);
  await lead.save();
  await activity(lead, req.user?._id, 'ai_analyzed', 'AI qualification completed', { score: result.score, priority: result.priority });
  res.json({ success: true, data: { analysis: result, lead } });
}

export async function addLeadNote(req, res) {
  const lead = await Lead.findOne(leadQuery(req.user, req.params.id));
  if (!lead) throw new AppError(404, 'Lead not found.');
  const note = req.validatedBody.message.trim();
  await activity(lead, req.user._id, 'note', note);
  res.status(201).json({ success: true, data: { message: 'Note added.' } });
}

export async function addWhatsAppActivity(req, res) {
  const lead = await Lead.findOne(leadQuery(req.user, req.params.id));
  if (!lead) throw new AppError(404, 'Lead not found.');
  if (req.validatedBody.followUp) {
    lead.followUpCount = (lead.followUpCount || 0) + 1;
    lead.lastContactedAt = new Date();
    await lead.save();
  }
  const entry = await activity(lead, req.user._id, 'whatsapp', `WhatsApp chat initiated by ${req.user.name}`);
  await entry.populate('actor', 'name');
  res.status(201).json({ success: true, data: { activity: entry } });
}

export async function dashboard(req, res) {
  const scope = leadScope(req.user);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  dayStart.setUTCDate(dayStart.getUTCDate() - 6);
  const [counts, weekly, sources, dailyLeads] = await Promise.all([
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.countDocuments({ ...scope, createdAt: { $gte: sevenDaysAgo } }),
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
    Lead.aggregate([
      { $match: { ...scope, createdAt: { $gte: dayStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);
  const byStatus = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]));
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  const [highPriority, averageScore, followUpsDue, recentLeads] = await Promise.all([
    Lead.countDocuments({ ...scope, aiScore: { $gte: 75 } }),
    Lead.aggregate([{ $match: scope }, { $group: { _id: null, average: { $avg: '$aiScore' } } }]),
    Lead.countDocuments({
      ...scope,
      status: 'CONTACTED',
      $or: [{ lastContactedAt: null }, { lastContactedAt: { $lte: new Date(Date.now() - 48 * 60 * 60 * 1000) } }]
    }),
    Lead.find(scope).sort({ createdAt: -1 }).limit(6).select('name phone email source status priority aiScore suggestedWhatsAppMessage createdAt')
  ]);
  res.json({ success: true, data: {
    metrics: { total, new: byStatus.NEW || 0, qualified: byStatus.QUALIFIED || 0, closed: byStatus.CLOSED || 0, lost: byStatus.LOST || 0, highPriority, averageAiScore: Math.round(averageScore[0]?.average || 0), followUpsDue, thisWeek: weekly, conversion: total ? Math.round(((byStatus.QUALIFIED || 0) / total) * 100) : 0 },
    byStatus: LEAD_STATUSES.map((status) => ({ status, count: byStatus[status] || 0 })),
    sources,
    dailyLeads: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(dayStart);
      date.setUTCDate(dayStart.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, count: dailyLeads.find((item) => item._id === key)?.count || 0 };
    }),
    recentLeads
  } });
}

export async function createWebhookLead(req, res) {
  const data = (await import('../utils/validation.js')).leadInputSchema.parse(req.body);
  const lead = await Lead.create({ ...data, ownerId: await leadOwnerId(null) });
  await activity(lead, null, 'webhook', 'Lead received via webhook', { source: lead.source });
  const webhookLeadResponse = responseLead(lead);
  scheduleAutomaticQualification(lead);
  sendLeadNotifications(lead, await notificationSettings(null)).catch((error) => console.error('Webhook lead email failed:', error.message));
  res.status(201).json({ success: true, data: { lead: webhookLeadResponse } });
}

export async function webhookLeadStatus(req, res) {
  const { leadId, status } = req.body;
  if (!/^[\da-f]{24}$/i.test(String(leadId || '')) || !LEAD_STATUSES.includes(status)) {
    throw new AppError(400, 'Provide a valid leadId and status.');
  }
  const lead = await Lead.findById(leadId);
  if (!lead) throw new AppError(404, 'Lead not found.');
  const previousStatus = lead.status;
  lead.status = status;
  await lead.save();
  await activity(lead, null, 'status_changed', `Status changed from ${previousStatus} to ${status} via webhook`, { from: previousStatus, to: status });
  res.json({ success: true, data: { lead } });
}

export async function webhookFollowUp(req, res) {
  const { leadId, message } = req.body;
  if (!/^[\da-f]{24}$/i.test(String(leadId || '')) || typeof message !== 'string' || message.trim().length < 2 || message.length > 3000) {
    throw new AppError(400, 'Provide a valid leadId and a message between 2 and 3000 characters.');
  }
  const lead = await Lead.findById(leadId);
  if (!lead) throw new AppError(404, 'Lead not found.');
  const delivery = await sendFollowUp(lead, message.trim());
  await activity(lead, null, 'webhook', delivery.sent ? 'Follow-up email sent via webhook' : 'Follow-up requested; email provider is not configured', { sent: delivery.sent });
  res.json({ success: true, data: { delivery } });
}

export async function webhookAnalyzeLead(req, res) {
  req.params.id = req.body.leadId;
  return analyzeLeadById(req, res);
}

export async function leadMetadata(_req, res) {
  const sources = await Lead.distinct('source', leadScope(_req.user));
  res.json({ success: true, data: { statuses: LEAD_STATUSES, priorities: LEAD_PRIORITIES, sources: sources.filter(Boolean).sort() } });
}