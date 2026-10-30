const express = require("express");
const { requireAdmin } = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const { recordAuditLog } = require("../services/auditLogger");

const router = express.Router();

const VALID_ROLES = ["CUSTOMER", "TELLER", "MANAGER", "ADMIN"];

// BMS-F-018: Admin creates a new user account
router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { fullName, email, mobile, password, role } = req.body;
    const adminId = req.user.id;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        error: "fullName, email, and password are required",
      });
    }

    const normalizedRole = role?.toUpperCase() || "CUSTOMER";

    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        error: `Role must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        mobile: mobile?.trim() || null,
        passwordHash,
        role: normalizedRole,
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

    await recordAuditLog({
      userId: adminId,
      event: "ADMIN_USER_CREATED",
      outcome: `USER:${user.id} ROLE:${normalizedRole}`,
    });

    return res.status(201).json({
      message: "User account created successfully",
      user,
    });
  } catch (error) {
    console.error("Admin create user error:", error.message);

    return res.status(500).json({
      error: "Unable to create user account",
    });
  }
});

// BMS-F-018: Admin updates a user's role
router.patch("/users/:userId/role", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { role } = req.body;
    const adminId = req.user.id;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    const normalizedRole = role?.toUpperCase();

    if (!normalizedRole || !VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        error: `Role must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: normalizedRole },
      select: { id: true, fullName: true, email: true, role: true },
    });

    await recordAuditLog({
      userId: adminId,
      event: "ADMIN_ROLE_UPDATED",
      outcome: `USER:${userId} FROM:${user.role} TO:${normalizedRole}`,
    });

    return res.status(200).json({
      message: "User role updated successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Admin role update error:", error.message);

    return res.status(500).json({
      error: "Unable to update user role",
    });
  }
});

// BMS-F-018: Admin lists all users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ users });
  } catch (error) {
    console.error("Admin list users error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch users",
    });
  }
});

module.exports = router;
