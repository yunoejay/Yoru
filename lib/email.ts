import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@example.com';

export async function sendVerificationEmail(email: string, code: string) {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return { sent: false, dev: true };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Your Yoru verification code',
    text: `Your verification code is: ${code}. It expires in 15 minutes.`
  });

  return { sent: true, dev: false };
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
    return { sent: false, dev: true, resetUrl };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Reset your Yoru password',
    text: `Use the link below to reset your password (valid for 30 minutes):\n${resetUrl}`
  });

  return { sent: true, dev: false, resetUrl };
}
