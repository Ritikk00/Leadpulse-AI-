import User from '../models/User.js';
import Lead from '../models/Lead.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { sendEmployeeWelcome } from '../services/emailService.js';

export async function listEmployees(_req, res) {
  const employees = await User.find({ role: 'employee' }).select('name email createdAt').sort({ name: 1 });
  res.json({ success: true, data: { employees: employees.map(({ _id, name, email }) => ({ id: String(_id), name, email })) } });
}

export async function listStaff(_req, res) {
  const staff = await User.find({}).select('name email role createdAt').sort({ role: 1, name: 1 });
  res.json({ success: true, data: { staff: staff.map(({ _id, name, email, role, createdAt }) => ({ id: String(_id), name, email, role, createdAt })) } });
}

export async function createEmployee(req, res) {
  const { name, email, temporaryPassword } = req.validatedBody;
  if (await User.exists({ email })) throw new AppError(409, 'An account with this email already exists.');
  const employee = await User.create({ name, email, role: 'employee', passwordHash: await bcrypt.hash(temporaryPassword, 12) });
  let delivery;
  try {
    delivery = await sendEmployeeWelcome(employee, temporaryPassword);
  } catch (error) {
    console.error('Employee welcome email failed:', error.message);
    delivery = { sent: false, reason: 'Welcome email could not be sent.' };
  }
  res.status(201).json({ success: true, data: {
    employee: { id: String(employee._id), name: employee.name, email: employee.email, role: employee.role, createdAt: employee.createdAt },
    delivery,
    ...(!delivery.sent ? { credentials: { email: employee.email, temporaryPassword }, notice: 'Share these credentials with the employee securely.' } : {})
  } });
}

export async function deleteEmployee(req, res) {
  const employee = await User.findOneAndDelete({ _id: req.params.id, role: 'employee' });
  if (!employee) throw new AppError(404, 'Employee not found.');
  await Lead.updateMany({ assignedTo: employee._id }, { $set: { assignedTo: null } });
  res.json({ success: true, data: { message: 'Employee removed.' } });
}