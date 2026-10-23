
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const otpStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// purpose distinguishes login OTPs from transfer OTPs
async function sendOtp(email, purpose = "LOGIN") {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER ||
      !process.env.SMTP_PASS) {
    throw new Error("Email service is not configured");
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  const subjects = {
    LOGIN: "Bank Management System - Login OTP",
    TRANSFER: "Bank Management System - Transfer Verification OTP",
  };

  const texts = {
    LOGIN: `Your login OTP is ${otp}. It expires in 5 minutes.`,
    TRANSFER: `Your transfer verification OTP is ${otp}. It expires in 5 minutes. Do not share this with anyone.`,
  };

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: subjects[purpose] || subjects.LOGIN,
    text: texts[purpose] || texts.LOGIN,
  });

  const key = `${purpose}:${email}`;

  otpStore.set(key, {
    hash: crypto.createHash("sha256").update(otp).digest("hex"),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });
}

function verifyOtp(email, submittedOtp, purpose = "LOGIN") {
  const key = `${purpose}:${email}`;
  const record = otpStore.get(key);

  if (!record || Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return false;
  }

  record.attempts += 1;

  if (record.attempts > MAX_ATTEMPTS) {
    otpStore.delete(key);
    return false;
  }

  const submittedHash = crypto
    .createHash("sha256")
    .update(String(submittedOtp))
    .digest("hex");

  const valid = crypto.timingSafeEqual(
    Buffer.from(record.hash, "hex"),
    Buffer.from(submittedHash, "hex")
  );

  if (valid) {
    otpStore.delete(key);
  }

  return valid;
}

module.exports = { sendOtp, verifyOtp };
