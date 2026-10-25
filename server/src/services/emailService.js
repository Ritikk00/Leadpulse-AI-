import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter;

function sender() {
  const address = env.EMAIL_FROM.match(/<([^<>]+)>/)?.[1] || env.EMAIL_FROM.trim();
  return { name: 'LeadPulse AI', address };
}

function brandedMessage(message) {
  return `LeadPulse AI\n\n${message}\n\n-- LeadPulse AI`;
}

function getTransporter() {
  if (!env.EMAIL_HOST || !env.EMAIL_USER || !env.EMAIL_PASS || !env.EMAIL_FROM) return null;
  transporter ||= nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
    tls: { rejectUnauthorized: env.EMAIL_TLS_REJECT_UNAUTHORIZED },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000
  });
  return transporter;
}

function logEmailError(operation, error) {
  console.error('[SMTP Error]:', {
    operation,
    code: error?.code,
    response: error?.response,
    message: error?.message
  }, error);
}

async function dispatchEmail(operation, options) {
  try {
    const mailer = getTransporter();
    if (!mailer) return { sent: false, reason: 'Email is not configured.' };
    await mailer.sendMail(options);
    return { sent: true };
  } catch (error) {
    logEmailError(operation, error);
    return { sent: false, reason: 'Email could not be sent.' };
  }
}

export async function verifyEmailTransport() {
  try {
    const mailer = getTransporter();
    if (!mailer) {
      console.log('[SMTP] Email is not configured; delivery is disabled.');
      return false;
    }
    await mailer.verify();
    console.log('[SMTP] Transporter is ready');
    return true;
  } catch (error) {
    logEmailError('transporter verification', error);
    return false;
  }
}

export async function sendLeadNotifications(lead, settings = {}) {
  const tasks = [];
  const adminEmail = settings.adminNotificationEmail || env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail && settings.adminNotifications !== false) {
    tasks.push(dispatchEmail('lead notification', {
      from: sender(),
      to: adminEmail,
      subject: `LeadPulse AI | New lead: ${lead.name}`,
      text: brandedMessage(`${lead.name} (${lead.email}) submitted a request.\n\n${lead.requirement}`)
    }));
  }
  if (settings.acknowledgementEnabled && lead.email) {
    tasks.push(dispatchEmail('lead acknowledgement', {
      from: sender(),
      to: lead.email,
      subject: 'LeadPulse AI | We received your request',
      text: brandedMessage(`Hi ${lead.name},\n\nThanks for getting in touch. Our team will review your request and follow up soon.`)
    }));
  }
  const results = await Promise.all(tasks);
  return {
    sent: results.some((result) => result.sent),
    ...(!results.some((result) => result.sent) && results.length ? { reason: results.find((result) => result.reason)?.reason } : {})
  };
}

export async function sendFollowUp(lead, message) {
  return dispatchEmail('follow-up', {
    from: sender(),
    to: lead.email,
    subject: 'LeadPulse AI | Following up on your request',
    text: brandedMessage(message)
  });
}

export async function sendPasswordReset(user, token) {
  const resetUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  return dispatchEmail('password reset', {
    from: sender(),
    to: user.email,
    subject: 'LeadPulse AI | Reset your password',
    text: brandedMessage(`Hi ${user.name},\n\nUse this one-time link within 30 minutes to reset your password:\n${resetUrl}`)
  });
}

export async function sendEmployeeWelcome(user, temporaryPassword) {
  const loginUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/portal/login`;
  return dispatchEmail('employee welcome', {
    from: sender(),
    to: user.email,
    subject: 'LeadPulse AI | Your team portal account',
    text: brandedMessage(`Hi ${user.name},\n\nYour LeadPulse AI team portal account is ready.\n\nEmail: ${user.email}\nTemporary password: ${temporaryPassword}\nPortal login: ${loginUrl}\n\nPlease change your password after signing in.`)
  });
}