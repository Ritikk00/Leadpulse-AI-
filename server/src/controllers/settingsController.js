import Settings from '../models/Settings.js';

export async function updateAutoAssign(req, res) {
  const settings = await Settings.findOneAndUpdate(
    { _id: 'global' },
    { $set: { autoAssign: req.validatedBody.autoAssign } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  const value = { autoAssign: settings.autoAssign };
  res.json({ success: true, settings: value, data: { settings: value } });
}
