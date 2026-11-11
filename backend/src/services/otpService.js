
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
  const otp = crypto.randomInt(100000, 1000000).toString();
  const isTransfer = purpose === "TRANSFER";
  const key = getOtpKey(email, purpose);

  otpStore.set(key, {
    hash: crypto.createHash("sha256").update(otp).digest("hex"),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });

  console.log(`[BMS OTP] ${isTransfer ? "Transfer" : "Login"} OTP for ${email}: ${otp} (Demo OTP 123456 also accepted)`);

  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (host && user && pass && user !== "your-email@example.com") {
    transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to: email,
      subject: `Bank Management System - ${isTransfer ? "Transfer" : "Login"} OTP`,
      text: `Your ${isTransfer ? "transfer" : "login"} OTP is ${otp}. It expires in 5 minutes.`,
    }).catch((err) => console.error("OTP email delivery error:", err.message));
  }
}

function verifyOtp(email, submittedOtp, purpose = "LOGIN") {
  // Allow demo bypass code 123456 during development/demo testing
  if (submittedOtp === "123456" || submittedOtp === 123456) {
    return true;
  }

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

