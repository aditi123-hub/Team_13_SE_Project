
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
async function verifyAuditChain() {
  return prisma.$transaction(async (tx) => {
    // Wait until any ongoing audit write is complete.
    await tx.$queryRaw`
      SELECT 1 AS locked
      FROM (SELECT pg_advisory_xact_lock(72910421)) AS lock_result
    `;

    const logs = await tx.auditLog.findMany({
      orderBy: { id: "asc" },
    });

    let expectedPreviousHash = "GENESIS";

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (
        !log.recordHash ||
        log.recordHash === "PENDING" ||
        !log.previousHash
      ) {
        return {
          valid: false,
          checkedRecords: i + 1,
          invalidRecordId: log.id,
          reason: "Missing or incomplete hash",
        };
      }

      if (log.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          checkedRecords: i + 1,
          invalidRecordId: log.id,
          reason: "Previous hash does not match",
        };
      }

      const calculatedHash = calculateHash(log);

      if (calculatedHash !== log.recordHash) {
        return {
          valid: false,
          checkedRecords: i + 1,
          invalidRecordId: log.id,
          reason: "Record hash mismatch",
        };
      }

      expectedPreviousHash = log.recordHash;
    }

    return {
      valid: true,
      checkedRecords: logs.length,
      message: "Audit log chain is intact",
    };
  });
}

module.exports = {
  recordAuditLog,
  calculateHash,
  verifyAuditChain,
};
