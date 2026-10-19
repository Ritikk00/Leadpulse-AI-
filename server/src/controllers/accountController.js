import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { AppError } from '../utils/errors.js';

export async function updateProfile(req, res) {
  const { name, currentPassword, newPassword } = req.validatedBody;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user) throw new AppError(404, 'Account not found.');
  if (name) user.name = name;
  if (newPassword) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(400, 'Current password is incorrect.');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
  }
  await user.save();
  res.json({ success: true, data: { user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
}

export async function getSettings(req, res) {
  const [user, globalSettings] = await Promise.all([
    User.findById(req.user._id).select('settings'),
    Settings.findOneAndUpdate(
      { _id: 'global' },
      { $setOnInsert: {} },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
  ]);
  const settings = {
    adminNotifications: user?.settings?.adminNotifications ?? true,
    acknowledgementEnabled: user?.settings?.acknowledgementEnabled ?? false,
    autoAssign: globalSettings.autoAssign
  };
  res.json({ success: true, settings: { autoAssign: settings.autoAssign }, data: { settings } });
}

export async function updateSettings(req, res) {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { settings: req.validatedBody } }, { new: true, runValidators: true }).select('settings');
  res.json({ success: true, data: { settings: user.settings } });
}