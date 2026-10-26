
const crypto = require("crypto");
const prisma = require("../config/prisma");

function calculateHash({
  id,
  userId,
  event,
  outcome,
  timestamp,
  previousHash,
}) {
  const record = JSON.stringify({
    id,
    userId,
    event,
    outcome,
    timestamp: new Date(timestamp).toISOString(),
    previousHash,
  });

  return crypto.createHash("sha256").update(record).digest("hex");
}

async function recordAuditLog({ userId = null, event, outcome }) {
  if (!event || !outcome) {
    throw new Error("Audit event and outcome are required");
  }

  return prisma.$transaction(async (tx) => {
    // Serialize audit writes so concurrent requests cannot share a predecessor.
    await tx.$queryRaw`
  SELECT 1 AS locked
  FROM (SELECT pg_advisory_xact_lock(72910421)) AS lock_result
`;
    const previous = await tx.auditLog.findFirst({
      orderBy: { id: "desc" },
      select: { recordHash: true },
    });

    if (previous && !previous.recordHash) {
      throw new Error(
        "Audit chain contains unhashed records; initialize the chain first"
      );
    }

    const previousHash = previous?.recordHash ?? "GENESIS";

    const created = await tx.auditLog.create({
      data: {
        userId,
        event,
        outcome,
        previousHash,
        recordHash: "PENDING",
      },
    });

    const recordHash = calculateHash({
      ...created,
      previousHash,
    });

    return tx.auditLog.update({
      where: { id: created.id },
      data: { recordHash },
    });
  });
}

module.exports = { recordAuditLog, calculateHash };
