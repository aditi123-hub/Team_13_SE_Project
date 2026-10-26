
const prisma = require("../src/config/prisma");
const { calculateHash } = require("../src/services/auditLogger");

async function main() {
  const records = await prisma.auditLog.findMany({
    orderBy: { id: "asc" },
  });

  let previousHash = "GENESIS";

  for (const record of records) {
    if (record.previousHash !== previousHash) {
      throw new Error(
        `Audit chain broken at record ${record.id}: previous hash mismatch`
      );
    }

    const expectedHash = calculateHash({
      ...record,
      previousHash,
    });

    if (record.recordHash !== expectedHash) {
      throw new Error(
        `Audit record ${record.id} has been modified or tampered with`
      );
    }

    previousHash = record.recordHash;
  }

  console.log(`Audit chain valid: ${records.length} records verified.`);
}

main()
  .catch((error) => {
    console.error("Audit verification failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
