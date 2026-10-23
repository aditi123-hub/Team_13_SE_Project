const express = require("express");
const {
  requireAuth,
  requireManager,
  requireCustomer,
} = require("../middleware/authMiddleware");
const prisma = require("../config/prisma");
const { randomUUID } = require("crypto");

const router = express.Router();

// BMS-F-005: Account Opening with KYC
// Customer submits an account opening application with KYC documents
router.post("/apply", requireCustomer, async (req, res) => {
  try {
    const { accountType, documents } = req.body;
    const userId = req.user.id;

    if (!accountType) {
      return res.status(400).json({
        error: "Account type is required",
      });
    }

    if (!["SAVINGS", "CURRENT"].includes(accountType)) {
      return res.status(400).json({
        error: "Account type must be SAVINGS or CURRENT",
      });
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        error: "At least one KYC document is required",
      });
    }

    // Validate each document has required fields
    for (const doc of documents) {
      if (!doc.documentType || !doc.documentValue) {
        return res.status(400).json({
          error: "Each document must have a documentType and documentValue",
        });
      }
    }

    // Check if customer already has a pending application
    const existingApplication = await prisma.kycApplication.findFirst({
      where: { userId, status: "PENDING" },
    });

    if (existingApplication) {
      return res.status(409).json({
        error: "You already have a pending KYC application",
        referenceNumber: existingApplication.referenceNumber,
      });
    }

    const referenceNumber = `KYC-${randomUUID().split("-")[0].toUpperCase()}`;

    const application = await prisma.kycApplication.create({
      data: {
        referenceNumber,
        userId,
        accountType,
        status: "PENDING",
        documents: {
          create: documents.map((doc) => ({
            documentType: doc.documentType.trim(),
            documentValue: doc.documentValue.trim(),
          })),
        },
      },
      include: {
        documents: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        event: "KYC_APPLICATION_SUBMITTED",
        outcome: `REF:${referenceNumber}`,
      },
    });

    return res.status(201).json({
      message: "KYC application submitted successfully",
      referenceNumber: application.referenceNumber,
      status: application.status,
      accountType: application.accountType,
    });
  } catch (error) {
    console.error("KYC application error:", error.message);

    return res.status(500).json({
      error: "Unable to submit KYC application",
    });
  }
});

// BMS-F-005: Get application status by reference number
router.get("/status/:referenceNumber", requireAuth, async (req, res) => {
  try {
    const { referenceNumber } = req.params;

    const application = await prisma.kycApplication.findUnique({
      where: { referenceNumber },
      select: {
        referenceNumber: true,
        accountType: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    if (!application) {
      return res.status(404).json({
        error: "Application not found",
      });
    }

    // Customers can only view their own applications
    if (req.user.role === "CUSTOMER") {
      const fullApp = await prisma.kycApplication.findUnique({
        where: { referenceNumber },
        select: { userId: true },
      });

      if (fullApp.userId !== req.user.id) {
        return res.status(403).json({
          error: "Access denied",
        });
      }
    }

    return res.status(200).json(application);
  } catch (error) {
    console.error("KYC status error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch application status",
    });
  }
});

// BMS-F-006: Manager views all pending KYC applications
router.get("/pending", requireManager, async (req, res) => {
  try {
    const applications = await prisma.kycApplication.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        referenceNumber: true,
        userId: true,
        accountType: true,
        status: true,
        createdAt: true,
        documents: {
          select: {
            documentType: true,
            documentValue: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("Fetch pending KYC error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch pending applications",
    });
  }
});

// BMS-F-006: Manager reviews a specific KYC application
router.get("/review/:id", requireManager, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid application ID",
      });
    }

    const application = await prisma.kycApplication.findUnique({
      where: { id },
      include: {
        documents: true,
      },
    });

    if (!application) {
      return res.status(404).json({
        error: "Application not found",
      });
    }

    return res.status(200).json(application);
  } catch (error) {
    console.error("KYC review fetch error:", error.message);

    return res.status(500).json({
      error: "Unable to fetch application",
    });
  }
});

// BMS-F-006: Manager approves or rejects a KYC application
router.post("/decision/:id", requireManager, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { decision, rejectionReason } = req.body;
    const managerId = req.user.id;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid application ID",
      });
    }

    if (!decision || !["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({
        error: "Decision must be APPROVED or REJECTED",
      });
    }

    if (decision === "REJECTED" && !rejectionReason?.trim()) {
      return res.status(400).json({
        error: "A rejection reason is required",
      });
    }

    const application = await prisma.kycApplication.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({
        error: "Application not found",
      });
    }

    if (application.status !== "PENDING") {
      return res.status(409).json({
        error: `Application has already been ${application.status.toLowerCase()}`,
      });
    }

    const updated = await prisma.kycApplication.update({
      where: { id },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" ? rejectionReason.trim() : null,
        reviewedBy: managerId,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: managerId,
        event: `KYC_APPLICATION_${decision}`,
        outcome: `REF:${application.referenceNumber}`,
      },
    });

    return res.status(200).json({
      message: `Application ${decision.toLowerCase()} successfully`,
      referenceNumber: updated.referenceNumber,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
    });
  } catch (error) {
    console.error("KYC decision error:", error.message);

    return res.status(500).json({
      error: "Unable to process decision",
    });
  }
});

module.exports = router;
