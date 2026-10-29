const express = require("express");
const {
  getMonthlyAvailability,
} = require("../services/availabilityService");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin-only monthly availability report.
router.get("/monthly", requireAdmin, async (req, res) => {
  try {
    const month = req.query.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        error: "Provide month in YYYY-MM format",
      });
    }

    const [year, monthNumber] = month.split("-").map(Number);

    if (monthNumber < 1 || monthNumber > 12) {
      return res.status(400).json({
        error: "Invalid month",
      });
    }

    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);

    const report = await getMonthlyAvailability({ start, end });

    return res.status(200).json({
      month,
      ...report,
      bankingHours: "09:00-18:00",
      excludesScheduledMaintenance: true,
    });
  } catch (error) {
    console.error("Failed to generate availability report:", error.message);

    return res.status(500).json({
      error: "Unable to generate availability report",
    });
  }
});

module.exports = router;