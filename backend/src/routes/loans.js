const express = require("express");
const { requireAuth, requireManager } = require("../middleware/authMiddleware");
const prisma = require("../config/prisma");
const auditLogger = require("../services/auditLogger");
const { randomUUID } = require("crypto");

const router = express.Router();

// BMS-F-014: Customer submits a loan application
router.post("/apply", requireAuth, async (req, res) => {
  try {
    const { amount, requestedAmount, tenureMonths, purpose } = req.body;
    const userId = req.user.id;

    const rawAmount = requestedAmount !== undefined ? requestedAmount : amount;

    if (!rawAmount || !purpose) {
      return res.status(400).json({
        error: "Amount and purpose are required",
      });
    }

    const parsedAmount = Number(rawAmount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    const parsedTenure = Number(tenureMonths) || 12;

    if (!Number.isInteger(parsedTenure) || parsedTenure <= 0) {
      return res.status(400).json({
        error: "Tenure must be a positive integer in months",
      });
    }

    if (typeof purpose !== "string" || !purpose.trim()) {
      return res.status(400).json({
        error: "Purpose must be a non-empty string",
      });
    }

    const referenceNumber = `LOAN-${randomUUID().split("-")[0].toUpperCase()}`;

    const loan = await prisma.loan.create({
      data: {
        referenceNumber,
        userId,
        requestedAmount: parsedAmount,
        tenureMonths: parsedTenure,
        purpose: purpose.trim(),
        status: "SUBMITTED",
      },
    });

    await auditLogger.recordAuditLog({
      userId,
      event: "LOAN_APPLICATION_SUBMITTED",
      outcome: `REF:${referenceNumber} AMOUNT:${parsedAmount}`,
    });

    return res.status(201).json({
      message: "Loan application submitted successfully",
      referenceNumber: loan.referenceNumber,
      requestedAmount: Number(loan.requestedAmount),
      status: loan.status,
    });
  } catch (error) {
    console.error("Loan application error:", error.message);

    return res.status(500).json({
      error: "Unable to submit loan application",
    });
  }
});

// BMS-F-014: Customer checks their loan application status
router.get("/status/:referenceNumber", requireAuth, async (req, res) => {
  try {
    const { referenceNumber } = req.params;

    const loan = await prisma.loan.findUnique({
      where: { referenceNumber },
      select: {
        id: true,
        referenceNumber: true,
        userId: true,
        requestedAmount: true,
        tenureMonths: true,
        purpose: true,
        status: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!loan) {
      return res.status(404).json({
        error: "Loan application not found",
      });
    }

    if (req.user.role === "CUSTOMER" && loan.userId !== req.user.id) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const { userId: _, ...response } = loan;
    return res.status(200).json({
      ...response,
      amount: Number(loan.requestedAmount),
      requestedAmount: Number(loan.requestedAmount),
    });
  } catch (error) {
    console.error("Loan status error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch loan status",
    });
  }
});

// BMS-F-015: Manager views pending loan applications
router.get("/pending", requireManager, async (req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { status: "SUBMITTED" },
      select: {
        id: true,
        referenceNumber: true,
        userId: true,
        requestedAmount: true,
        tenureMonths: true,
        purpose: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({
      loans: loans.map((l) => ({
        ...l,
        amount: Number(l.requestedAmount),
        requestedAmount: Number(l.requestedAmount),
      })),
    });
  } catch (error) {
    console.error("Fetch pending loans error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch pending loan applications",
    });
  }
});

// BMS-F-015 + BMS-F-016: Manager approves or rejects a loan, customer is notified
router.post("/decision/:id", requireManager, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { decision, remarks } = req.body;
    const managerId = req.user.id;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid loan ID",
      });
    }

    const normalizedDecision = decision?.toUpperCase();

    if (!normalizedDecision || !["APPROVED", "REJECTED"].includes(normalizedDecision)) {
      return res.status(400).json({
        error: "Decision must be APPROVED or REJECTED",
      });
    }

    if (!remarks?.trim()) {
      return res.status(400).json({
        error: "Remarks are required for a loan decision",
      });
    }

    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan) {
      return res.status(404).json({
        error: "Loan application not found",
      });
    }

    if (loan.status !== "SUBMITTED") {
      return res.status(200).json({
        message: `Loan application ${loan.status.toLowerCase()} successfully`,
        referenceNumber: loan.referenceNumber,
        status: loan.status,
        remarks: loan.remarks || remarks,
      });
    }

    // Get the customer's email for notification (BMS-F-016)
    const customer = await prisma.user.findUnique({
      where: { id: loan.userId },
      select: { email: true },
    });

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: normalizedDecision,
        remarks: remarks.trim(),
        reviewedBy: managerId,
      },
    });

    await auditLogger.recordAuditLog({
      userId: managerId,
      event: `LOAN_${normalizedDecision}`,
      outcome: `REF:${loan.referenceNumber} CUSTOMER:${loan.userId}`,
    });

    // BMS-F-016: Notify customer via email
    if (customer?.email && process.env.SMTP_USER && process.env.SMTP_USER !== "your-email@example.com") {
      try {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || process.env.EMAIL_HOST,
          port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER || process.env.EMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
          },
        });

        const subject =
          normalizedDecision === "APPROVED"
            ? "Your loan application has been approved"
            : "Your loan application has been rejected";

        const text =
          normalizedDecision === "APPROVED"
            ? `Your loan application (Ref: ${loan.referenceNumber}) for ${Number(loan.requestedAmount)} has been approved.\n\nRemarks: ${remarks.trim()}`
            : `Your loan application (Ref: ${loan.referenceNumber}) for ${Number(loan.requestedAmount)} has been rejected.\n\nRemarks: ${remarks.trim()}`;

        transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.EMAIL_USER,
          to: customer.email,
          subject,
          text,
        }).catch((err) => console.error("Loan notification email error:", err.message));
      } catch (emailError) {
        console.error("Loan notification email error:", emailError.message);
      }
    } else if (customer?.email) {
      console.log(`[BMS Notification] Loan decision notification logged for ${customer.email}`);
    }

    return res.status(200).json({
      message: `Loan application ${normalizedDecision.toLowerCase()} successfully`,
      referenceNumber: updated.referenceNumber,
      status: updated.status,
      remarks: updated.remarks,
    });
  } catch (error) {
    console.error("Loan decision error:", error.message);

    return res.status(500).json({
      error: "Unable to process loan decision",
    });
  }
});

module.exports = router;
