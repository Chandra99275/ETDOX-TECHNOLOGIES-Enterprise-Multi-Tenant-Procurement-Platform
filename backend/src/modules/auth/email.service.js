
import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP configuration is incomplete. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
    );
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number.");
  }

  return {
    host,
    port,
    secure:
      process.env.SMTP_SECURE === "true" ||
      port === 465,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  };
}

function getTransporter() {
  return nodemailer.createTransport(getSmtpConfig());
}

function getSender() {
  return (
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "no-reply@localhost"
  );
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getRecipient(input) {
  if (typeof input === "string") {
    return input.trim();
  }

  return (
    input?.email ||
    input?.user?.email ||
    input?.to ||
    ""
  ).trim();
}

function getName(input) {
  if (typeof input === "string") {
    return "";
  }

  return (
    input?.name ||
    input?.fullName ||
    input?.user?.fullName ||
    [
      input?.user?.firstName || input?.firstName,
      input?.user?.lastName || input?.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    "there"
  );
}

function getOtp(input) {
  if (typeof input === "string" || typeof input === "number") {
    return String(input);
  }

  return String(
    input?.otp ??
    input?.code ??
    input?.verificationCode ??
    input?.resetOtp ??
    ""
  );
}

function getLink(input, type) {
  if (!input || typeof input !== "object") {
    return "";
  }

  const directLink =
    input.link ||
    input.url ||
    input.verificationUrl ||
    input.resetUrl;

  if (directLink) {
    return String(directLink);
  }

  const token = input.token;

  const frontendUrl = (
    process.env.FRONTEND_URL ||
    process.env.CORS_ORIGIN ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");

  if (!token) {
    return "";
  }

  const path =
    type === "verification"
      ? "/verify-email"
      : "/reset-password";

  return `${frontendUrl}${path}?token=${encodeURIComponent(token)}`;
}

async function sendEmail({ to, subject, text, html }) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("A valid recipient email address is required.");
  }

  const transporter = getTransporter();

  return transporter.sendMail({
    from: getSender(),
    to,
    subject,
    text,
    html,
  });
}

/**
 * Send an email verification message.
 *
 * Supports an object containing email, name, otp/code, and
 * verificationUrl/link/token, or a simple email string.
 */
export async function sendVerificationEmail(input = {}) {
  const to = getRecipient(input);
  const name = getName(input);
  const otp = getOtp(input);
  const link = getLink(input, "verification");

  const greeting = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  const safeLink = escapeHtml(link);

  const linkSection = link
    ? `\n\nVerify your email using this link:\n${link}`
    : "";

  const otpSection = otp
    ? `\n\nYour verification code is: ${otp}\nThis code should be used only by you.`
    : "";

  if (!otp && !link) {
    throw new Error(
      "Verification email requires an OTP or verification link."
    );
  }

  return sendEmail({
    to,
    subject: "Verify your ETDOX account",
    text:
      `Hello ${name},\n\n` +
      "Please verify your email address to continue with ETDOX." +
      otpSection +
      linkSection +
      "\n\nIf you did not create this account, you can ignore this email.",
    html: `
      <!doctype html>
      <html>
        <body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">
          <div style="max-width:560px;margin:auto;background:#ffffff;padding:32px;border-radius:12px">
            <h2 style="margin-top:0;color:#153e75">Verify your ETDOX account</h2>
            <p>Hello ${greeting},</p>
            <p>Please verify your email address to continue with ETDOX.</p>
            ${
              otp
                ? `<div style="margin:24px 0;padding:18px;background:#eef5ff;border-radius:8px;text-align:center">
                     <p style="margin:0 0 8px">Your verification code</p>
                     <strong style="font-size:28px;letter-spacing:5px">${safeOtp}</strong>
                   </div>`
                : ""
            }
            ${
              link
                ? `<p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#1769e0;color:white;text-decoration:none;border-radius:6px">Verify email</a></p>`
                : ""
            }
            <p style="font-size:13px;color:#64748b">If you did not create this account, you can ignore this email.</p>
          </div>
        </body>
      </html>
    `,
  });
}

/**
 * Send a password-reset OTP or reset link.
 */
export async function sendPasswordResetEmail(input = {}) {
  const to = getRecipient(input);
  const name = getName(input);
  const otp = getOtp(input);
  const link = getLink(input, "reset");

  if (!otp && !link) {
    throw new Error(
      "Password reset email requires an OTP or reset link."
    );
  }

  const greeting = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  const safeLink = escapeHtml(link);

  const otpSection = otp
    ? `\n\nYour password reset code is: ${otp}`
    : "";

  const linkSection = link
    ? `\n\nReset your password using this link:\n${link}`
    : "";

  return sendEmail({
    to,
    subject: "Reset your ETDOX password",
    text:
      `Hello ${name},\n\n` +
      "We received a request to reset your ETDOX password." +
      otpSection +
      linkSection +
      "\n\nIf you did not request this change, ignore this email and keep your password secure.",
    html: `
      <!doctype html>
      <html>
        <body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">
          <div style="max-width:560px;margin:auto;background:#ffffff;padding:32px;border-radius:12px">
            <h2 style="margin-top:0;color:#153e75">Reset your password</h2>
            <p>Hello ${greeting},</p>
            <p>We received a request to reset your ETDOX password.</p>
            ${
              otp
                ? `<div style="margin:24px 0;padding:18px;background:#eef5ff;border-radius:8px;text-align:center">
                     <p style="margin:0 0 8px">Your password reset code</p>
                     <strong style="font-size:28px;letter-spacing:5px">${safeOtp}</strong>
                   </div>`
                : ""
            }
            ${
              link
                ? `<p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#1769e0;color:white;text-decoration:none;border-radius:6px">Reset password</a></p>`
                : ""
            }
            <p style="font-size:13px;color:#64748b">If you did not request this change, ignore this email.</p>
          </div>
        </body>
      </html>
    `,
  });
}

/**
 * Verify that SMTP credentials and server settings work.
 */
export async function testSmtpConnection() {
  const transporter = getTransporter();

  try {
    await transporter.verify();

    return {
      success: true,
      message: "SMTP connection verified successfully.",
    };
  } finally {
    transporter.close();
  }
}

/**
 * Backward-compatible alias for services using this name.
 */
export async function testSmtp() {
  return testSmtpConnection();
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  testSmtpConnection,
  testSmtp,
};
