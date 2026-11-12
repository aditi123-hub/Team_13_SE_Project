
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const https = require("https");

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

/**
 * Dispatches an actual SMS to a cellular mobile phone via configured SMS Gateways.
 * Supported gateways:
 * 1. Fast2SMS (Indian mobile numbers, free tier available at fast2sms.com)
 * 2. Twilio (Global SMS API)
 * 3. Msg91 (India)
 */
async function sendRealSms(mobile, otp, purpose = "LOGIN") {
  if (!mobile) return;
  const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);
  if (cleanMobile.length < 10) return;

  const purposeLabel = purpose === "TRANSFER" ? "transfer" : "login";
  const message = `Your Bankwise ${purposeLabel} OTP is ${otp}. Valid for 5 minutes. Do not share this code.`;

  // 1. Fast2SMS (India)
  const fast2SmsKey = process.env.FAST2SMS_API_KEY;
  if (fast2SmsKey) {
    try {
      const postData = JSON.stringify({
        route: "otp",
        variables_values: otp,
        numbers: cleanMobile,
      });

      const options = {
        hostname: "www.fast2sms.com",
        path: "/dev/bulkV2",
        method: "POST",
        headers: {
          authorization: fast2SmsKey,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log(`[Fast2SMS Gateway] Real SMS dispatched to +91 ${cleanMobile}. Status: ${res.statusCode}, Body: ${body}`);
        });
      });
      req.on("error", (err) => console.error("[Fast2SMS Error]:", err.message));
      req.write(postData);
      req.end();
      return;
    } catch (err) {
      console.error("[Fast2SMS Exception]:", err.message);
    }
  }

  // 2. Twilio SMS (Global)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  if (twilioSid && twilioAuth && twilioFrom) {
    try {
      const fullNumber = cleanMobile.length === 10 ? `+91${cleanMobile}` : cleanMobile;
      const params = new URLSearchParams({
        To: fullNumber,
        From: twilioFrom,
        Body: message,
      }).toString();

      const options = {
        hostname: "api.twilio.com",
        path: `/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(params),
        },
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log(`[Twilio Gateway] Real SMS dispatched to ${fullNumber}. Status: ${res.statusCode}`);
        });
      });
      req.on("error", (err) => console.error("[Twilio Error]:", err.message));
      req.write(params);
      req.end();
      return;
    } catch (err) {
      console.error("[Twilio Exception]:", err.message);
    }
  }

  // 3. Msg91 (India)
  const msg91AuthKey = process.env.MSG91_AUTH_KEY;
  const msg91TemplateId = process.env.MSG91_TEMPLATE_ID;
  if (msg91AuthKey && msg91TemplateId) {
    try {
      const postData = JSON.stringify({
        template_id: msg91TemplateId,
        mobile: `91${cleanMobile}`,
        otp: otp,
      });

      const options = {
        hostname: "control.msg91.com",
        path: "/api/v5/otp",
        method: "POST",
        headers: {
          authkey: msg91AuthKey,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log(`[Msg91 Gateway] Real SMS dispatched to +91 ${cleanMobile}. Status: ${res.statusCode}`);
        });
      });
      req.on("error", (err) => console.error("[Msg91 Error]:", err.message));
      req.write(postData);
      req.end();
      return;
    } catch (err) {
      console.error("[Msg91 Exception]:", err.message);
    }
  }

  console.log(`[SMS Gateway Info] Real cellular SMS ready. To route through Fast2SMS or Twilio, provide FAST2SMS_API_KEY or TWILIO_ACCOUNT_SID in backend/.env`);
}

async function sendOtp(email, purpose = "LOGIN", mobile = null) {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const isTransfer = purpose === "TRANSFER";
  const key = getOtpKey(email, purpose);

  otpStore.set(key, {
    hash: crypto.createHash("sha256").update(otp).digest("hex"),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    otp, // Retained in-memory
  });

  const targetLabel = mobile ? `mobile +91 ${mobile} / ${email}` : email;
  console.log(`[BMS OTP SMS] ${isTransfer ? "Transfer" : "Login"} OTP for ${targetLabel}: ${otp} (Demo OTP 123456 also accepted)`);

  // Dispatch actual real-world SMS over cellular network
  await sendRealSms(mobile, otp, purpose);

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

  return {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    mobile,
    email,
  };
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

