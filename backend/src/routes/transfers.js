
const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const prisma = require("../config/prisma");
const { sendOtp, verifyOtp } = require("../services/otpService");
const { recordAuditLog } = require("../services/auditLogger");

const router = express.Router();

// Transfers at or above this amount require OTP verification.
const HIGH_VALUE_THRESHOLD =
  Number(process.env.HIGH_VALUE_THRESHOLD) || 10000;

// Step 1: Initiate a transfer.
router.post("/initiate", requireAuth, async (req, res) => {
  try {
    const { toAccountId, amount } = req.body;
    const userId = req.user.id;

    if (!toAccountId || amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        error: "Recipient account and amount are required",
      });
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // High-value transfers require an OTP.
    if (parsedAmount >= HIGH_VALUE_THRESHOLD) {
      await sendOtp(user.email, "TRANSFER");

      await recordAuditLog({
        userId,
        event: "TRANSFER_OTP_SENT",
        outcome: `TO:${toAccountId} AMOUNT:${parsedAmount}`,
      });

      return res.status(200).json({
        message: "OTP sent to your registered email to verify this transfer",
        requiresOtp: true,
        threshold: HIGH_VALUE_THRESHOLD,
      });
    }

    // Record initiation of a low-value transfer.
    await recordAuditLog({
      userId,
      event: "TRANSFER_INITIATED",
      outcome: `TO:${toAccountId} AMOUNT:${parsedAmount}`,
    });

    return res.status(200).json({
      message: "Transfer initiated successfully",
      requiresOtp: false,
      amount: parsedAmount,
    });
  } catch (error) {
    console.error("Transfer initiation error:", error.message);

    return res.status(500).json({
      error: "Unable to initiate transfer",
    });
  }
});

// Step 2: Verify OTP for a high-value transfer.
router.post("/verify-otp", requireAuth, async (req, res) => {
  try {
    const { otp, toAccountId, amount } = req.body;
    const userId = req.user.id;

    if (!otp || !toAccountId || amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        error: "OTP, recipient account, and amount are required",
      });
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    if (parsedAmount < HIGH_VALUE_THRESHOLD) {
      return res.status(400).json({
        error: "OTP verification is only required for high-value transfers",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const valid = verifyOtp(user.email, otp, "TRANSFER");

    if (!valid) {
      await recordAuditLog({
        userId,
        event: "TRANSFER_OTP_FAILED",
        outcome: `TO:${toAccountId} AMOUNT:${parsedAmount}`,
      });

      return res.status(401).json({
        error: "Invalid or expired OTP",
      });
    }

    await recordAuditLog({
      userId,
      event: "HIGH_VALUE_TRANSFER_CONFIRMED",
      outcome: `TO:${toAccountId} AMOUNT:${parsedAmount}`,
    });

    return res.status(200).json({
      message: "Transfer verified and confirmed successfully",
      amount: parsedAmount,
      toAccountId,
    });
  } catch (error) {
    console.error("Transfer OTP verification error:", error.message);

    return res.status(500).json({
      error: "Unable to verify transfer OTP",
    });
  }
});

module.exports = router;
