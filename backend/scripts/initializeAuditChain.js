
const crypto = require("crypto");
const prisma = require("../src/config/prisma");

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

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
  SELECT 1 AS locked
  FROM (SELECT pg_advisory_xact_lock(72910421)) AS lock_result
`;

    const records = await tx.auditLog.findMany({
      orderBy: { id: "asc" },
    });

    let previousHash = "GENESIS";

    for (const record of records) {
      if (record.recordHash || record.previousHash) {
        throw new Error(
          `Audit record ${record.id} is already initialized. Stopping safely.`
        );
      }

      const hash = calculateHash({
        ...record,
        previousHash,
      });

      await tx.auditLog.update({
        where: { id: record.id },
        data: {
          previousHash,
          recordHash: hash,
        },
      });

      previousHash = hash;
    }

    console.log(`Initialized ${records.length} audit records.`);
  });
}

main()
  .catch((error) => {
    console.error("Audit chain initialization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
