import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter;

function sender() {
  const address = env.SMTP_FROM.match(/<([^<>]+)>/)?.[1] || env.SMTP_FROM.trim();
  return { name: 'LeadPulse AI', address };
}

function brandedMessage(message) {
  return `LeadPulse AI\n\n${message}\n\n-- LeadPulse AI`;
}

function getTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) return null;
  transporter ||= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
  });
  return transporter;
}

export async function sendLeadNotifications(lead, settings = {}) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: 'SMTP is not configured.' };
  const tasks = [];
  const adminEmail = settings.adminNotificationEmail || env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail && settings.adminNotifications !== false) {
    tasks.push(mailer.sendMail({
      from: sender(),
      to: adminEmail,
      subject: `LeadPulse AI | New lead: ${lead.name}`,
      text: brandedMessage(`${lead.name} (${lead.email}) submitted a request.\n\n${lead.requirement}`)
    }));
  }
  if (settings.acknowledgementEnabled && lead.email) {
    tasks.push(mailer.sendMail({
      from: sender(),
      to: lead.email,
      subject: 'LeadPulse AI | We received your request',
      text: brandedMessage(`Hi ${lead.name},\n\nThanks for getting in touch. Our team will review your request and follow up soon.`)
    }));
  }
  await Promise.all(tasks);
  return { sent: tasks.length > 0 };
}

export async function sendFollowUp(lead, message) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: 'SMTP is not configured.' };
  await mailer.sendMail({
    from: sender(),
    to: lead.email,
    subject: 'LeadPulse AI | Following up on your request',
    text: brandedMessage(message)
  });
  return { sent: true };
}

export async function sendPasswordReset(user, token) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: 'SMTP is not configured.' };
  const resetUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  await mailer.sendMail({
    from: sender(),
    to: user.email,
    subject: 'LeadPulse AI | Reset your password',
    text: brandedMessage(`Hi ${user.name},\n\nUse this one-time link within 30 minutes to reset your password:\n${resetUrl}`)
  });
  return { sent: true };
}

export async function sendEmployeeWelcome(user, temporaryPassword) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: 'SMTP is not configured.' };
  const loginUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/portal/login`;
  await mailer.sendMail({
    from: sender(),
    to: user.email,
    subject: 'LeadPulse AI | Your team portal account',
    text: brandedMessage(`Hi ${user.name},\n\nYour LeadPulse AI team portal account is ready.\n\nEmail: ${user.email}\nTemporary password: ${temporaryPassword}\nPortal login: ${loginUrl}\n\nPlease change your password after signing in.`)
  });
  return { sent: true };
}