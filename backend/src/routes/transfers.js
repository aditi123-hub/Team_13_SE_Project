const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const prisma = require("../config/prisma");
const { sendOtp, verifyOtp } = require("../services/otpService");
const { recordAuditLog } = require("../services/auditLogger");
const { randomUUID } = require("crypto");

const router = express.Router();

const HIGH_VALUE_THRESHOLD = Number(process.env.HIGH_VALUE_THRESHOLD) || 10000;
const DAILY_TRANSFER_LIMIT = Number(process.env.DAILY_TRANSFER_LIMIT) || 50000;

// Reset daily transfer total if it's a new calendar day
async function getAvailableDailyLimit(account) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastDate = account.lastTransferDate
    ? new Date(account.lastTransferDate)
    : null;

  if (!lastDate || lastDate < today) {
    // New day - reset
    await prisma.account.update({
      where: { id: account.id },
      data: { dailyTransferred: 0, lastTransferDate: new Date() },
    });
    return DAILY_TRANSFER_LIMIT;
  }

  return DAILY_TRANSFER_LIMIT - account.dailyTransferred;
}

// BMS-F-011: Intra-bank funds transfer - Step 1: initiate
router.post("/initiate", requireAuth, async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, note } = req.body;
    const userId = req.user.id;

    if (!fromAccountId || !toAccountId || amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        error: "fromAccountId, toAccountId, and amount are required",
      });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({
        error: "Source and destination accounts must be different",
      });
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    // Validate source account belongs to the requesting user
    const fromAccount = await prisma.account.findUnique({
      where: { id: Number(fromAccountId) },
    });

    if (!fromAccount || fromAccount.userId !== userId) {
      return res.status(403).json({
        error: "Source account not found or access denied",
      });
    }

    if (!fromAccount.isActive) {
      return res.status(400).json({
        error: "Source account is not active",
      });
    }

    // Validate destination account exists
    const toAccount = await prisma.account.findUnique({
      where: { id: Number(toAccountId) },
    });

    if (!toAccount || !toAccount.isActive) {
      return res.status(404).json({
        error: "Destination account not found or inactive",
      });
    }

    // Check sufficient balance
    if (fromAccount.balance < parsedAmount) {
      return res.status(400).json({
        error: "Insufficient balance",
      });
    }

    // BMS-F-013: Daily limit enforcement
    const available = await getAvailableDailyLimit(fromAccount);

    if (parsedAmount > available) {
      return res.status(400).json({
        error: `Transfer exceeds daily limit. Available: ${available}`,
        availableLimit: available,
        dailyLimit: DAILY_TRANSFER_LIMIT,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // BMS-F-012: OTP required for high-value transfers
    if (parsedAmount >= HIGH_VALUE_THRESHOLD) {
      await sendOtp(user.email, "TRANSFER");

      await recordAuditLog({
        userId,
        event: "TRANSFER_OTP_SENT",
        outcome: `FROM:${fromAccountId} TO:${toAccountId} AMOUNT:${parsedAmount}`,
      });

      return res.status(200).json({
        message: "OTP sent to your registered email to verify this transfer",
        requiresOtp: true,
        threshold: HIGH_VALUE_THRESHOLD,
      });
    }

    // Execute low-value transfer directly
    const referenceNumber = `TXN-${randomUUID().split("-")[0].toUpperCase()}`;

    await prisma.$transaction([
      prisma.account.update({
        where: { id: fromAccount.id },
        data: {
          balance: { decrement: parsedAmount },
          dailyTransferred: { increment: parsedAmount },
          lastTransferDate: new Date(),
        },
      }),
      prisma.account.update({
        where: { id: toAccount.id },
        data: { balance: { increment: parsedAmount } },
      }),
      prisma.transaction.create({
        data: {
          referenceNumber,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount: parsedAmount,
          note: note?.trim() || null,
        },
      }),
    ]);

    await recordAuditLog({
      userId,
      event: "TRANSFER_COMPLETED",
      outcome: `REF:${referenceNumber} FROM:${fromAccountId} TO:${toAccountId} AMOUNT:${parsedAmount}`,
    });

    return res.status(200).json({
      message: "Transfer completed successfully",
      referenceNumber,
      amount: parsedAmount,
    });
  } catch (error) {
    console.error("Transfer initiation error:", error.message);

    return res.status(500).json({
      error: "Unable to initiate transfer",
    });
  }
});

// BMS-F-012: Verify OTP and complete high-value transfer
router.post("/verify-otp", requireAuth, async (req, res) => {
  try {
    const { otp, fromAccountId, toAccountId, amount, note } = req.body;
    const userId = req.user.id;

    if (!otp || !fromAccountId || !toAccountId || amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        error: "otp, fromAccountId, toAccountId, and amount are required",
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

    const fromAccount = await prisma.account.findUnique({
      where: { id: Number(fromAccountId) },
    });

    if (!fromAccount || fromAccount.userId !== userId) {
      return res.status(403).json({
        error: "Source account not found or access denied",
      });
    }

    if (fromAccount.balance < parsedAmount) {
      return res.status(400).json({
        error: "Insufficient balance",
      });
    }

    const available = await getAvailableDailyLimit(fromAccount);

    if (parsedAmount > available) {
      return res.status(400).json({
        error: `Transfer exceeds daily limit. Available: ${available}`,
      });
    }

    const toAccount = await prisma.account.findUnique({
      where: { id: Number(toAccountId) },
    });

    if (!toAccount || !toAccount.isActive) {
      return res.status(404).json({
        error: "Destination account not found or inactive",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const valid = verifyOtp(user.email, otp, "TRANSFER");

    if (!valid) {
      await recordAuditLog({
        userId,
        event: "TRANSFER_OTP_FAILED",
        outcome: `FROM:${fromAccountId} TO:${toAccountId} AMOUNT:${parsedAmount}`,
      });

      return res.status(401).json({
        error: "Invalid or expired OTP",
      });
    }

    const referenceNumber = `TXN-${randomUUID().split("-")[0].toUpperCase()}`;

    await prisma.$transaction([
      prisma.account.update({
        where: { id: fromAccount.id },
        data: {
          balance: { decrement: parsedAmount },
          dailyTransferred: { increment: parsedAmount },
          lastTransferDate: new Date(),
        },
      }),
      prisma.account.update({
        where: { id: toAccount.id },
        data: { balance: { increment: parsedAmount } },
      }),
      prisma.transaction.create({
        data: {
          referenceNumber,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount: parsedAmount,
          note: note?.trim() || null,
        },
      }),
    ]);

    await recordAuditLog({
      userId,
      event: "HIGH_VALUE_TRANSFER_COMPLETED",
      outcome: `REF:${referenceNumber} FROM:${fromAccountId} TO:${toAccountId} AMOUNT:${parsedAmount}`,
    });

    return res.status(200).json({
      message: "Transfer verified and completed successfully",
      referenceNumber,
      amount: parsedAmount,
    });
  } catch (error) {
    console.error("Transfer OTP verification error:", error.message);

    return res.status(500).json({
      error: "Unable to complete transfer",
    });
  }
});

module.exports = router;
