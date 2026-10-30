
require("dotenv").config();

const jwt = require("jsonwebtoken");
const prisma = require("../src/config/prisma");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  if (!databaseUrl || !jwtSecret) {
    throw new Error("DATABASE_URL or JWT_SECRET is missing.");
  }

  const database = new URL(databaseUrl);

  if (!["localhost", "127.0.0.1", "::1"].includes(database.hostname)) {
    throw new Error("Refusing to run: database must be local.");
  }

  const userId = Number(process.env.LOAD_TEST_USER_ID);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Set LOAD_TEST_USER_ID to your dedicated test customer's ID.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "CUSTOMER") {
    throw new Error("Test customer not found or account is not a CUSTOMER.");
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const session = await prisma.userSession.create({
    data: { userId: user.id, expiresAt },
  });

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      sessionId: session.id,
    },
    jwtSecret,
    { expiresIn: "30m" }
  );

  console.log("Local test session created.");
  console.log("User ID:", user.id);
  console.log("Session expires:", expiresAt.toISOString());
  console.log("\nSet this token in your current terminal with:");
  console.log(`export TOKEN='${token}'`);
  console.log("\nKeep this token private.");
}

main()
  .catch((error) => {
    console.error("Could not create test session:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
