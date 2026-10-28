
const express = require("express");
const prisma = require("../config/prisma");
const { requireAdmin } = require("../middleware/authMiddleware");
const { RETENTION_YEARS } = require("../config/auditRetention");
const router = express.Router();

// Admin-only, read-only, paginated audit log review.
router.get("/", requireAdmin, async (req, res) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const parsedOffset = Number.parseInt(req.query.offset, 10);

    const limit = Number.isNaN(parsedLimit)
      ? 50
      : Math.min(Math.max(parsedLimit, 1), 100);

    const offset = Number.isNaN(parsedOffset)
      ? 0
      : Math.max(parsedOffset, 0);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { id: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          userId: true,
          event: true,
          outcome: true,
          timestamp: true,
          previousHash: true,
          recordHash: true,
        },
      }),
      prisma.auditLog.count(),
    ]);

    return res.status(200).json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
retentionPolicy: {
  minimumRetentionYears: RETENTION_YEARS,
},
    });
  } catch (error) {
    console.error("Failed to retrieve audit logs:", error.message);
    return res.status(500).json({
      error: "Unable to retrieve audit logs",
    });
  }
});

module.exports = router;
