
const express = require("express");
const { requireAdmin } = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { sendOtp, verifyOtp } = require("../services/otpService");

const router = express.Router();

// Customer Registration Endpoint (BMS-F-001)
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, mobile, governmentIdNum, password } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        error: "Full name, email, and password are required",
      });
    }

    if (!governmentIdNum && !mobile) {
      return res.status(400).json({
        error: "Either mobile number or government ID number is required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for duplicate email
    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    // Check for duplicate mobile if provided
    if (mobile) {
      const existingMobile = await prisma.user.findUnique({
        where: { mobile: mobile.trim() },
      });

      if (existingMobile) {
        return res.status(409).json({
          error: "An account with this mobile number already exists",
        });
      }
    }

    // Check for duplicate government ID if provided
    if (governmentIdNum) {
      const existingGovId = await prisma.user.findUnique({
        where: { governmentIdNum: governmentIdNum.trim() },
      });

      if (existingGovId) {
        return res.status(409).json({
          error: "An account with this government ID already exists",
        });
      }
    }

    // Hash password using bcrypt with salt (BMS-SR-002)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        mobile: mobile ? mobile.trim() : null,
        governmentIdNum: governmentIdNum ? governmentIdNum.trim() : null,
        passwordHash,
        role: "CUSTOMER",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        role: true,
        createdAt: true,
      },
    });

    // Log successful registration (without sensitive data)
    await prisma.auditLog.create({
      data: {
        userId: newUser.id,
        event: "CUSTOMER_REGISTRATION",
        outcome: "SUCCESS",
      },
    });

    return res.status(201).json({
      message: "Customer registered successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    return res.status(500).json({
      error: "Unable to complete registration",
    });
  }
});

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

// Admin updates a user's role (BMS-F-004)
router.patch("/role/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { role } = req.body;

    const allowedRoles = ["CUSTOMER", "TELLER", "MANAGER", "ADMIN"];

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: "Role must be CUSTOMER, TELLER, MANAGER, or ADMIN",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!existingUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        event: "ADMIN_ROLE_UPDATED",
        outcome: `USER:${userId};ROLE:${role}`,
      },
    });

    return res.status(200).json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Role update error:", error.message);

    return res.status(500).json({
      error: "Unable to update user role",
    });
  }
});

module.exports = router;
