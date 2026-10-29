const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const prisma = require("../config/prisma");

const router = express.Router();

// BMS-F-017: Mini-statement - last 10 transactions for an account
router.get("/:accountId/mini", requireAuth, async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const userId = req.user.id;

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({
        error: "Invalid account ID",
      });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, userId: true, balance: true, accountType: true },
    });

    if (!account) {
      return res.status(404).json({
        error: "Account not found",
      });
    }

    // Only account owner or staff can view statements
    if (req.user.role === "CUSTOMER" && account.userId !== userId) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: accountId },
          { toAccountId: accountId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        referenceNumber: true,
        fromAccountId: true,
        toAccountId: true,
        amount: true,
        note: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      accountId,
      accountType: account.accountType,
      currentBalance: account.balance,
      transactions: transactions.map((t) => ({
        ...t,
        type: t.fromAccountId === accountId ? "DEBIT" : "CREDIT",
      })),
    });
  } catch (error) {
    console.error("Mini-statement error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch mini-statement",
    });
  }
});

// BMS-F-017: Full statement - all transactions within a date range
router.get("/:accountId/full", requireAuth, async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const userId = req.user.id;
    const { from, to } = req.query;

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({
        error: "Invalid account ID",
      });
    }

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to date query parameters are required (YYYY-MM-DD)",
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        error: "from date must be before to date",
      });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, userId: true, balance: true, accountType: true },
    });

    if (!account) {
      return res.status(404).json({
        error: "Account not found",
      });
    }

    if (req.user.role === "CUSTOMER" && account.userId !== userId) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: accountId },
          { toAccountId: accountId },
        ],
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        referenceNumber: true,
        fromAccountId: true,
        toAccountId: true,
        amount: true,
        note: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      accountId,
      accountType: account.accountType,
      currentBalance: account.balance,
      period: { from, to },
      transactions: transactions.map((t) => ({
        ...t,
        type: t.fromAccountId === accountId ? "DEBIT" : "CREDIT",
      })),
    });
  } catch (error) {
    console.error("Full statement error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch full statement",
    });
  }
});

module.exports = router;
