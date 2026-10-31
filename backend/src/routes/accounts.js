const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const prisma = require("../config/prisma");
const { recordAuditLog } = require("../services/auditLogger");
const { randomUUID } = require("crypto");

const router = express.Router();

const DAILY_WITHDRAWAL_LIMIT = Number(process.env.DAILY_WITHDRAWAL_LIMIT) || 50000;

function generateReference(prefix) {
  return `${prefix}-${randomUUID().split("-")[0].toUpperCase()}`;
}

// BMS-F-008: Cash deposit and balance update
router.post("/:accountId/deposit", requireAuth, async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const { amount } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({ error: "Amount is required" });
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (account.status !== "ACTIVE") {
      return res.status(400).json({ error: "Account is not active" });
    }

    // Only the account owner or teller/manager/admin can deposit
    if (req.user.role === "CUSTOMER" && account.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const referenceNumber = generateReference("DEP");

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          referenceNumber,
          type: "DEPOSIT",
          destinationAccountId: accountId,
          amount: parsedAmount,
          status: "COMPLETED",
          performedBy: userId,
        },
      }),
      prisma.account.update({
        where: { id: accountId },
        data: { balance: { increment: parsedAmount } },
      }),
    ]);

    await recordAuditLog({
      userId,
      event: "DEPOSIT_COMPLETED",
      outcome: `REF:${referenceNumber} ACCOUNT:${accountId} AMOUNT:${parsedAmount}`,
    });

    return res.status(201).json({
      message: "Deposit recorded successfully",
      receipt: {
        referenceNumber: transaction.referenceNumber,
        amount: parsedAmount,
        accountId,
        type: "DEPOSIT",
        status: "COMPLETED",
        timestamp: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("Deposit error:", error.message);
    return res.status(500).json({ error: "Unable to process deposit" });
  }
});

// BMS-F-009: Withdrawal with balance and daily limit checks
router.post("/:accountId/withdraw", requireAuth, async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const { amount } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({ error: "Amount is required" });
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (account.status !== "ACTIVE") {
      return res.status(400).json({ error: "Account is not active" });
    }

    if (req.user.role === "CUSTOMER" && account.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check sufficient balance
    if (Number(account.balance) < parsedAmount) {
      return res.status(400).json({
        error: "Insufficient balance",
        available: Number(account.balance),
      });
    }

    // BMS-F-009: Daily withdrawal limit - sum today's withdrawals
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayWithdrawals = await prisma.transaction.aggregate({
      where: {
        sourceAccountId: accountId,
        type: "WITHDRAWAL",
        status: "COMPLETED",
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    });

    const withdrawnToday = Number(todayWithdrawals._sum.amount || 0);

    if (withdrawnToday + parsedAmount > DAILY_WITHDRAWAL_LIMIT) {
      const remaining = DAILY_WITHDRAWAL_LIMIT - withdrawnToday;
      return res.status(400).json({
        error: `Withdrawal exceeds daily limit. Remaining today: ${remaining}`,
        dailyLimit: DAILY_WITHDRAWAL_LIMIT,
        remainingToday: remaining,
      });
    }

    const referenceNumber = generateReference("WDR");

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          referenceNumber,
          type: "WITHDRAWAL",
          sourceAccountId: accountId,
          amount: parsedAmount,
          status: "COMPLETED",
          performedBy: userId,
        },
      }),
      prisma.account.update({
        where: { id: accountId },
        data: { balance: { decrement: parsedAmount } },
      }),
    ]);

    await recordAuditLog({
      userId,
      event: "WITHDRAWAL_COMPLETED",
      outcome: `REF:${referenceNumber} ACCOUNT:${accountId} AMOUNT:${parsedAmount}`,
    });

    return res.status(201).json({
      message: "Withdrawal processed successfully",
      receipt: {
        referenceNumber: transaction.referenceNumber,
        amount: parsedAmount,
        accountId,
        type: "WITHDRAWAL",
        status: "COMPLETED",
        timestamp: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("Withdrawal error:", error.message);
    return res.status(500).json({ error: "Unable to process withdrawal" });
  }
});

// BMS-F-010: Get transaction receipt by reference number
router.get("/receipt/:referenceNumber", requireAuth, async (req, res) => {
  try {
    const { referenceNumber } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { referenceNumber },
      select: {
        referenceNumber: true,
        type: true,
        sourceAccountId: true,
        destinationAccountId: true,
        amount: true,
        status: true,
        createdAt: true,
        performedBy: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Only show receipts for completed transactions (BMS-F-010)
    if (transaction.status !== "COMPLETED") {
      return res.status(400).json({
        error: "Receipt is only available for completed transactions",
        status: transaction.status,
      });
    }

    // Customers can only view receipts for their own accounts
    if (req.user.role === "CUSTOMER") {
      const accountIds = [
        transaction.sourceAccountId,
        transaction.destinationAccountId,
      ].filter(Boolean);

      const ownedAccount = await prisma.account.findFirst({
        where: {
          id: { in: accountIds },
          userId: req.user.id,
        },
      });

      if (!ownedAccount) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    return res.status(200).json({
      receipt: {
        referenceNumber: transaction.referenceNumber,
        type: transaction.type,
        amount: Number(transaction.amount),
        status: transaction.status,
        timestamp: transaction.createdAt,
        sourceAccountId: transaction.sourceAccountId,
        destinationAccountId: transaction.destinationAccountId,
      },
    });
  } catch (error) {
    console.error("Receipt error:", error.message);
    return res.status(500).json({ error: "Unable to fetch receipt" });
  }
});

// BMS-F-007: Account activation notification
// Called internally when a KYC application is approved and account is created
router.post("/:accountId/activate", requireAuth, async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    // Only managers/admins can activate accounts
    if (!["MANAGER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Manager access required" });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (account.status === "ACTIVE") {
      return res.status(409).json({ error: "Account is already active" });
    }

    await prisma.account.update({
      where: { id: accountId },
      data: { status: "ACTIVE" },
    });

    await recordAuditLog({
      userId: req.user.id,
      event: "ACCOUNT_ACTIVATED",
      outcome: `ACCOUNT:${accountId} USER:${account.userId}`,
    });

    // Send activation notification email (BMS-F-007)
    if (account.user?.email) {
      try {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: account.user.email,
          subject: "Your bank account has been activated",
          text: `Dear ${account.user.fullName},\n\nYour ${account.accountType} account (Account No: ${account.accountNumber}) has been activated and is ready to use.\n\nThank you for banking with us.`,
        });
      } catch (emailError) {
        console.error("Activation notification email error:", emailError.message);
      }
    }

    return res.status(200).json({
      message: "Account activated and customer notified",
      accountId,
      accountNumber: account.accountNumber,
    });
  } catch (error) {
    console.error("Account activation error:", error.message);
    return res.status(500).json({ error: "Unable to activate account" });
  }
});

module.exports = router;
