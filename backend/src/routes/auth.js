
const express = require("express");
const { requireAdmin } = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { sendOtp, verifyOtp } = require("../services/otpService");

const router = express.Router();


const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Step 1: Validate credentials, enforce lockout, and send OTP
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Reject login while the account is locked.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({
        error: "Account locked after 5 failed login attempts. Try again after the cooldown period.",
      });
    }

    // Clear an expired lockout.
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      const failedLogins = user.lockedUntil ? 1 : user.failedLogins + 1;

      const lockedUntil =
        failedLogins >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_DURATION_MS)
          : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins,
          lockedUntil,
        },
      });

      if (lockedUntil) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      event: "LOGIN_LOCKOUT",
      outcome: "ACCOUNT_LOCKED",
    },
  });

  return res.status(423).json({
    error: "Account locked after 5 failed login attempts. Try again in 15 minutes.",
  });
}

      return res.status(401).json({
        error: "Invalid email or password",
        remainingAttempts: MAX_FAILED_ATTEMPTS - failedLogins,
      });
    }

    // A correct password resets consecutive failed attempts.
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    await sendOtp(user.email);

    return res.status(200).json({
      message: "OTP sent to your registered email",
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      error: "Unable to process login",
    });
  }
});

// Step 2: Verify OTP and issue login token
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        error: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !verifyOtp(normalizedEmail, otp)) {
      return res.status(401).json({
        error: "Invalid or expired OTP",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        error: "Login service is not configured",
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("OTP verification error:", error.message);

    return res.status(500).json({
      error: "Unable to verify OTP",
    });
  }
});
// Administrator unlocks a customer's account
router.post("/unlock/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLogins: 0,
        lockedUntil: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        event: "ADMIN_ACCOUNT_UNLOCK",
        outcome: "ACCOUNT_UNLOCKED",
      },
    });

    return res.status(200).json({
      message: "Account unlocked successfully",
    });
  } catch (error) {
    console.error("Account unlock error:", error.message);

    return res.status(500).json({
      error: "Unable to unlock account",
    });
  }
});
module.exports = router;
