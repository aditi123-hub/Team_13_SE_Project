
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getOtpKey(email, purpose) {
  return `${purpose}:${email.toLowerCase()}`;
}

async function sendOtp(email, purpose = "LOGIN") {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error("Email service is not configured");
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const isTransfer = purpose === "TRANSFER";
  const key = getOtpKey(email, purpose);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Bank Management System - ${isTransfer ? "Transfer" : "Login"} OTP`,
    text: `Your ${isTransfer ? "transfer" : "login"} OTP is ${otp}. It expires in 5 minutes.`,
  });

  otpStore.set(key, {
    hash: crypto.createHash("sha256").update(otp).digest("hex"),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });
}

function verifyOtp(email, submittedOtp, purpose = "LOGIN") {
  const key = getOtpKey(email, purpose);
  const record = otpStore.get(key);

  if (!record || Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return false;
  }

  record.attempts += 1;

  if (record.attempts > 5) {
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

