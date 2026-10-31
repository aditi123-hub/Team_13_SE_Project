
const express = require("express");
const { requireManager } = require("../middleware/authMiddleware");

const {
  getTransactionReport,
  getAccountReport,
  getLoanReport,
} = require("../services/reportService");

const router = express.Router();
const PDFDocument = require("pdfkit");
const { Parser } = require("json2csv");
// Validate and parse reporting period
function validateDateRange(req, res, next) {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: "Both startDate and endDate are required",
    });
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    return res.status(400).json({
      error: "Dates must be in YYYY-MM-DD format",
    });
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== startDate ||
    end.toISOString().slice(0, 10) !== endDate ||
    start > end
  ) {
    return res.status(400).json({
      error: "Invalid reporting date range",
    });
  }

  req.reportStartDate = start;
  req.reportEndDate = new Date(end.getTime() + 86400000);

  next();
}

// GET /api/reports?type=transactions&startDate=2026-10-01&endDate=2026-10-31
router.get(
  "/",
  requireManager,
  validateDateRange,
  async (req, res) => {
    try {
      const { type } = req.query;
      const startDate = req.reportStartDate;
      const endDate = req.reportEndDate;

      let report;

      switch (type) {
        case "transactions":
          report = await getTransactionReport(startDate, endDate);
          break;

        case "accounts":
          report = await getAccountReport(startDate, endDate);
          break;

        case "loans":
          report = await getLoanReport(startDate, endDate);
          break;

        default:
          return res.status(400).json({
            error: "Invalid report type. Choose transactions, accounts, or loans.",
          });
      }

      return res.status(200).json({
        success: true,
        reportType: type,
        reportingPeriod: {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        },
        data: report,
      });
    } catch (error) {
      console.error("Report generation error:", error);

      return res.status(500).json({
        error: "Unable to generate report",
      });
    }
  }
);

// GET /api/reports/export?type=transactions&format=csv&startDate=2026-10-01&endDate=2026-10-31
router.get(
  "/export",
  requireManager,
  validateDateRange,
  async (req, res) => {
    try {
      const { type, format } = req.query;
      const startDate = req.reportStartDate;
      const endDate = req.reportEndDate;

      let report;

      switch (type) {
        case "transactions":
          report = await getTransactionReport(startDate, endDate);
          break;
        case "accounts":
          report = await getAccountReport(startDate, endDate);
          break;
        case "loans":
          report = await getLoanReport(startDate, endDate);
          break;
        default:
          return res.status(400).json({
            error: "Invalid report type. Choose transactions, accounts, or loans.",
          });
      }

      if (format === "csv") {
        const rows = report.transactions || report.accounts || report.loans;

        const defaultFields = {
  transactions: [
    "id",
    "referenceNumber",
    "type",
    "amount",
    "status",
    "createdAt",
  ],
  accounts: [
    "id",
    "accountNumber",
    "accountType",
    "status",
    "createdAt",
  ],
  loans: [
    "id",
    "referenceNumber",
    "requestedAmount",
    "tenureMonths",
    "status",
    "createdAt",
  ],
};

const parser = new Parser({
  fields: rows.length > 0
    ? Object.keys(rows[0])
    : defaultFields[type],
});

        const csv = parser.parse(rows);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${type}-report.csv"`
        );

        return res.status(200).send(csv);
      }

      if (format === "pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${type}-report.pdf"`
        );

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        doc.fontSize(20).text("Bank Management System", {
          align: "center",
        });

        doc.moveDown();
        doc.fontSize(16).text(`${type.toUpperCase()} REPORT`, {
          align: "center",
        });

        doc.moveDown();
        doc.fontSize(11).text(
          `Reporting Period: ${req.query.startDate} to ${req.query.endDate}`
        );

        doc.moveDown();

        doc.fontSize(12).text("Report Summary", {
          underline: true,
        });

        doc.moveDown(0.5);
        const summary = Object.entries(report).filter(
          ([, value]) => typeof value !== "object"
        );

        summary.forEach(([key, value]) => {
          doc.fontSize(10).text(`${key}: ${value}`);
        });

        const rows = report.transactions || report.accounts || report.loans;

        doc.moveDown();
        doc.fontSize(12).text("Report Records", {
          underline: true,
        });
        doc.moveDown(0.5);

        if (rows.length === 0) {
          doc.fontSize(10).text("No records found for this reporting period.");
        } else {
          rows.forEach((record, index) => {
            doc.fontSize(9).text(
              `${index + 1}. ${JSON.stringify(record)}`,
              { width: 500 }
            );
            doc.moveDown(0.5);
          });
        }

        doc.end();
        return;
      }

      return res.status(400).json({
        error: "Invalid export format. Choose csv or pdf.",
      });
    } catch (error) {
      console.error("Report export error:", error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Unable to export report",
        });
      }
      res.destroy(error);
    }
  }
);

module.exports = router;
