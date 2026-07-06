const nodemailer = require("nodemailer");
const crypto = require("crypto");
const logger = require("../utils/logger");

const createTransporter = () => {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
  };

  return nodemailer.createTransport(config);
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getOTPExpiryTime = () => {
  return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
};

const getOTPSecret = () => process.env.OTP_SECRET || process.env.JWT_SECRET || "local-otp-secret";

const hashOTP = (otp) => {
  return crypto
    .createHmac("sha256", getOTPSecret())
    .update(String(otp).trim())
    .digest("hex");
};

const isOTPMatch = (otp, otpHash) => {
  if (!otp || !otpHash) {
    return false;
  }

  const candidate = hashOTP(otp);
  if (candidate.length !== otpHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(otpHash));
};

const sendOTPEmail = async (email, otp, userName) => {
  const transporter = createTransporter();

  if (!transporter) {
    const message = "SMTP_HOST is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in backend/.env, then restart the backend.";
    logger.error("[OTP Email Service] %s", message, {
      email
    });
    throw new Error(message);
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from || !email) {
    throw new Error("Email sender and recipient are required");
  }

  logger.info("[OTP Email Service] Verifying SMTP transport");
  await transporter.verify();
  logger.info("[OTP Email Service] SMTP verify successful");

  try {
    logger.info("[OTP Email Service] Sending OTP email", {
      to: email
    });

    const result = await transporter.sendMail({
      from,
      to: email,
      subject: "Verify your AI Hiring account",
      text: [
        `Hi ${userName},`,
        "",
        "Your verification code is:",
        "",
        otp,
        "",
        "This code expires in 5 minutes.",
        "",
        "If you didn't request this code, please ignore this email.",
        "",
        "Best,",
        "AI Hiring Team"
      ].join("\n"),
      html: `
        <p>Hi ${userName},</p>
        <p>Your verification code is:</p>
        <h2 style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">${otp}</h2>
        <p>This code expires in 5 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best,<br/>AI Hiring Team</p>
      `
    });

    logger.info("[OTP Email Service] OTP email sent", {
      to: email,
      messageId: result.messageId,
      response: result.response
    });

    return result;
  } catch (error) {
    logger.error("[OTP Email Service] OTP email failed", {
      to: email,
      error: error.message
    });
    throw error;
  }
};

module.exports = {
  generateOTP,
  getOTPExpiryTime,
  hashOTP,
  isOTPMatch,
  sendOTPEmail
};
