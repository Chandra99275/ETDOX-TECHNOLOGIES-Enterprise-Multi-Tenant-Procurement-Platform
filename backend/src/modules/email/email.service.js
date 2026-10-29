import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

let cachedTransporter = null;

/**
 * Returns a singleton Nodemailer transporter or null if not configured.
 */
export function getTransporter() {
  if (!env.smtp.isConfigured) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
    tls: {
      rejectUnauthorized: env.isProduction,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return cachedTransporter;
}

/**
 * Verify SMTP connectivity with the configured provider.
 */
export async function verifyConnection() {
  const transporter = getTransporter();

  if (!transporter) {
    return {
      success: false,
      configured: false,
      message: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (or EMAIL and SECRET) in .env.",
    };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      configured: true,
      host: env.smtp.host,
      port: env.smtp.port,
      user: env.smtp.user,
      message: "SMTP server connection verified successfully.",
    };
  } catch (error) {
    return {
      success: false,
      configured: true,
      host: env.smtp.host,
      port: env.smtp.port,
      message: error.message || "Failed to authenticate with SMTP server.",
      error,
    };
  }
}

/**
 * Base email layout for ETDOX branded emails.
 */
function createHtmlEmail({ title, preheader, bodyHtml, ctaText, ctaUrl, footerNote }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 24px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .email-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      color: #ffffff;
      padding: 32px 36px;
      text-align: left;
    }
    .brand-badge {
      display: inline-block;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .brand-sub {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #93c5fd;
      font-weight: 600;
    }
    .email-content {
      padding: 36px 36px 28px 36px;
      color: #334155;
      font-size: 15px;
    }
    .email-content h1 {
      font-size: 22px;
      color: #0f172a;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .button-container {
      margin: 28px 0;
      text-align: left;
    }
    .cta-button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      padding: 13px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    }
    .alt-link {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
    }
    .alt-link a {
      color: #2563eb;
    }
    .email-footer {
      background-color: #f1f5f9;
      padding: 24px 36px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .security-badge {
      display: inline-block;
      background-color: #e0e7ff;
      color: #3730a3;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || title}
  </div>
  <div class="email-wrapper">
    <div class="email-header">
      <div class="brand-badge">ETDOX</div>
      <div class="brand-sub">Enterprise Procurement Platform</div>
    </div>
    <div class="email-content">
      ${bodyHtml}
      ${
        ctaText && ctaUrl
          ? `
        <div class="button-container">
          <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" class="cta-button">${ctaText}</a>
        </div>
        <div class="alt-link">
          If the button does not work, copy and paste this URL into your browser:<br>
          <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer">${ctaUrl}</a>
        </div>
      `
          : ""
      }
    </div>
    <div class="email-footer">
      <div class="security-badge">Verified System Notice</div>
      <p style="margin: 0 0 8px 0;">${footerNote || "This is an automated system message from ETDOX Technologies."}</p>
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} ETDOX Technologies Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Send an email message safely.
 */
export async function sendMail({ to, subject, html, text }) {
  const transporter = getTransporter();

  if (!transporter) {
    const errorMsg = "SMTP transporter is not configured. Email could not be sent.";
    console.warn(`[EmailService] ${errorMsg} (To: ${to}, Subject: ${subject})`);
    return {
      success: false,
      delivered: false,
      error: errorMsg,
    };
  }

  const from = `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });

    console.info(`[EmailService] Email delivered successfully to ${to}. MessageId: ${info.messageId}`);

    return {
      success: true,
      delivered: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
    return {
      success: false,
      delivered: false,
      error: error.message,
    };
  }
}

/**
 * Send email verification code (OTP) and link to user.
 */
export async function sendVerificationEmail({ to, name, token, otp, expiresAt }) {
  const verifyUrl = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}${otp ? `&otp=${encodeURIComponent(otp)}` : ""}`;
  const title = otp
    ? `[ETDOX] Your Verification Code is ${otp}`
    : "Verify your ETDOX account email";

  const otpDisplayHtml = otp
    ? `
      <div style="text-align: center; margin: 24px 0; padding: 22px; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 14px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #1e40af; font-weight: 700;">Your One-Time Verification Code</p>
        <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #1d4ed8; font-family: 'Courier New', monospace; margin: 4px 0;">
          ${otp}
        </div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Enter this 6-digit code on the verification screen or click the button below.</p>
      </div>
    `
    : "";

  const bodyHtml = `
    <h1>Verify your email address</h1>
    <p>Hello <strong>${name || "there"}</strong>,</p>
    <p>Thank you for registering with <strong>ETDOX Enterprise Procurement Platform</strong>. Please verify your work email address to activate your account and access your organization's workspace.</p>
    ${otpDisplayHtml}
    <p>This verification code and link will expire in <strong>${env.emailVerificationTtlMinutes / 60} hours</strong>.</p>
  `;

  const text = `
Verify your ETDOX account email

Hello ${name || "there"},

Thank you for registering with ETDOX Enterprise Procurement Platform.

${otp ? `YOUR 6-DIGIT VERIFICATION CODE (OTP): ${otp}\n\n` : ""}
Or use the direct verification link below:
${verifyUrl}

This code will expire in ${env.emailVerificationTtlMinutes / 60} hours.

If you did not create this account, please ignore this email.
`;

  const html = createHtmlEmail({
    title,
    preheader: otp
      ? `Your ETDOX verification code is ${otp}. Valid for ${env.emailVerificationTtlMinutes / 60} hours.`
      : "Please verify your email address to activate your ETDOX workspace.",
    bodyHtml,
    ctaText: "Verify Email Automatically",
    ctaUrl: verifyUrl,
    footerNote: "If you did not request this account, you can safely ignore this message.",
  });

  return sendMail({
    to,
    subject: title,
    html,
    text,
  });
}

/**
 * Send password reset link.
 */
export async function sendPasswordResetEmail({ to, name, token, expiresAt }) {
  const resetUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const title = "Reset your ETDOX password";

  const bodyHtml = `
    <h1>Password Reset Request</h1>
    <p>Hello <strong>${name || "there"}</strong>,</p>
    <p>We received a request to reset the password for your ETDOX account associated with <strong>${to}</strong>.</p>
    <p>Click the button below to choose a new password. This single-use link is valid for <strong>${env.passwordResetTtlMinutes} minutes</strong>.</p>
  `;

  const text = `
Password Reset Request

Hello ${name || "there"},

We received a request to reset your ETDOX password. Use the link below to set a new password:

${resetUrl}

This single-use link will expire in ${env.passwordResetTtlMinutes} minutes.

If you did not request a password reset, please ignore this email. Your password will remain unchanged.
`;

  const html = createHtmlEmail({
    title,
    preheader: "Reset instructions for your ETDOX account password.",
    bodyHtml,
    ctaText: "Reset Password",
    ctaUrl: resetUrl,
    footerNote: "If you did not request a password reset, no action is required and your account remains secure.",
  });

  return sendMail({
    to,
    subject: title,
    html,
    text,
  });
}

/**
 * Send password changed security notification.
 */
export async function sendPasswordChangedEmail({ to, name }) {
  const title = "Your ETDOX password was successfully changed";
  const timestamp = new Date().toUTCString();

  const bodyHtml = `
    <h1>Password Updated</h1>
    <p>Hello <strong>${name || "there"}</strong>,</p>
    <p>The password for your ETDOX account (<strong>${to}</strong>) was changed on <strong>${timestamp}</strong>.</p>
    <p>All previous login sessions have been invalidated for security.</p>
    <p>If you made this change, no further action is needed.</p>
    <p style="color: #dc2626; font-weight: 600;">If you did NOT change your password, please contact your organization administrator or ETDOX Security immediately.</p>
  `;

  const text = `
Password Updated

Hello ${name || "there"},

The password for your ETDOX account (${to}) was changed on ${timestamp}.
All previous sessions have been invalidated.

If you did not make this change, please contact your organization administrator or ETDOX Security immediately.
`;

  const html = createHtmlEmail({
    title,
    preheader: "Security alert: Your ETDOX password was updated.",
    bodyHtml,
    footerNote: "This security notification was generated automatically following an account update.",
  });

  return sendMail({
    to,
    subject: title,
    html,
    text,
  });
}

/**
 * Send organization invitation email.
 */
export async function sendInvitationEmail({ to, inviterName, orgName, roleName, token, expiresAt }) {
  const inviteUrl = `${env.frontendUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
  const title = `Invitation to join ${orgName || "ETDOX"}`;

  const bodyHtml = `
    <h1>You're invited to join ${orgName || "ETDOX"}</h1>
    <p>Hello,</p>
    <p><strong>${inviterName || "An administrator"}</strong> has invited you to join <strong>${orgName}</strong> on the ETDOX Enterprise Procurement Platform with the role of <strong>${roleName}</strong>.</p>
    <p>Click below to accept your invitation, create your password, and access the platform.</p>
  `;

  const text = `
Invitation to join ${orgName || "ETDOX"}

You have been invited by ${inviterName || "an administrator"} to join ${orgName} on ETDOX as a ${roleName}.

Accept your invitation here:
${inviteUrl}
`;

  const html = createHtmlEmail({
    title,
    preheader: `You've been invited to join ${orgName} on ETDOX.`,
    bodyHtml,
    ctaText: "Accept Invitation",
    ctaUrl: inviteUrl,
    footerNote: "If you were not expecting this invitation, you can ignore this email.",
  });

  return sendMail({
    to,
    subject: title,
    html,
    text,
  });
}

/**
 * Safe development/diagnostic SMTP test.
 */
export async function testSmtp(toEmail) {
  const verification = await verifyConnection();

  if (!verification.success) {
    return {
      success: false,
      verification,
      message: "SMTP verification failed.",
    };
  }

  const subject = "ETDOX Platform — SMTP Test Delivery";
  const bodyHtml = `
    <h1>SMTP Diagnostic Test</h1>
    <p>This is a diagnostic email sent by the <strong>ETDOX Enterprise Platform</strong> to verify SMTP configuration and delivery.</p>
    <p>Timestamp: <strong>${new Date().toISOString()}</strong></p>
    <p>SMTP Host: <strong>${env.smtp.host}:${env.smtp.port}</strong> (Secure: ${env.smtp.secure})</p>
  `;

  const result = await sendMail({
    to: toEmail,
    subject,
    html: createHtmlEmail({
      title: subject,
      bodyHtml,
    }),
    text: `ETDOX SMTP Diagnostic Test\nTimestamp: ${new Date().toISOString()}\nHost: ${env.smtp.host}`,
  });

  return {
    ...result,
    verification,
  };
}
