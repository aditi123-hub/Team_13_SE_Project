require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../src/config/prisma");

async function main() {
  console.log("Seeding Bank Management System demo data for Sprint 2...\n");

  const passwordHash = await bcrypt.hash("password123", 12);

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@bank.com" },
    update: { role: "ADMIN" },
    create: {
      fullName: "System Administrator",
      email: "admin@bank.com",
      mobile: "9000000001",
      governmentIdNum: "GOVADMIN001",
      passwordHash,
      role: "ADMIN",
    },
  });

  // 2. Create Manager
  const manager = await prisma.user.upsert({
    where: { email: "manager@bank.com" },
    update: { role: "MANAGER" },
    create: {
      fullName: "Branch Manager",
      email: "manager@bank.com",
      mobile: "9000000002",
      governmentIdNum: "GOVMGR002",
      passwordHash,
      role: "MANAGER",
    },
  });

  // 3. Create Customer 1
  const customer1 = await prisma.user.upsert({
    where: { email: "customer1@bank.com" },
    update: { role: "CUSTOMER" },
    create: {
      fullName: "Demo Customer One",
      email: "customer1@bank.com",
      mobile: "9000000003",
      governmentIdNum: "GOVCUST003",
      passwordHash,
      role: "CUSTOMER",
    },
  });

  // 4. Create Customer 2
  const customer2 = await prisma.user.upsert({
    where: { email: "customer2@bank.com" },
    update: { role: "CUSTOMER" },
    create: {
      fullName: "Demo Customer Two",
      email: "customer2@bank.com",
      mobile: "9000000004",
      governmentIdNum: "GOVCUST004",
      passwordHash,
      role: "CUSTOMER",
    },
  });

  // 5. Create KYC application for Customer 1 if not exists
  let kyc1 = await prisma.kycApplication.findFirst({
    where: { userId: customer1.id },
  });
  if (!kyc1) {
    kyc1 = await prisma.kycApplication.create({
      data: {
        referenceNumber: "KYC-DEMO-001",
        userId: customer1.id,
        accountType: "SAVINGS",
        status: "APPROVED",
        reviewedBy: manager.id,
        reviewedAt: new Date(),
      },
    });
  }

  // 6. Create KYC application for Customer 2 if not exists
  let kyc2 = await prisma.kycApplication.findFirst({
    where: { userId: customer2.id },
  });
  if (!kyc2) {
    kyc2 = await prisma.kycApplication.create({
      data: {
        referenceNumber: "KYC-DEMO-002",
        userId: customer2.id,
        accountType: "CURRENT",
        status: "APPROVED",
        reviewedBy: manager.id,
        reviewedAt: new Date(),
      },
    });
  }

  // 7. Create Account 1
  let account1 = await prisma.account.findUnique({
    where: { applicationId: kyc1.id },
  });
  if (!account1) {
    account1 = await prisma.account.create({
      data: {
        accountNumber: "ACCT-100001",
        userId: customer1.id,
        applicationId: kyc1.id,
        accountType: "SAVINGS",
        balance: 50000,
        status: "ACTIVE",
      },
    });
  } else {
    account1 = await prisma.account.update({
      where: { id: account1.id },
      data: { status: "ACTIVE", balance: 50000 },
    });
  }

  // 8. Create Account 2
  let account2 = await prisma.account.findUnique({
    where: { applicationId: kyc2.id },
  });
  if (!account2) {
    account2 = await prisma.account.create({
      data: {
        accountNumber: "ACCT-100002",
        userId: customer2.id,
        applicationId: kyc2.id,
        accountType: "CURRENT",
        balance: 10000,
        status: "ACTIVE",
      },
    });
  } else {
    account2 = await prisma.account.update({
      where: { id: account2.id },
      data: { status: "ACTIVE" },
    });
  }

  // 9. Generate active sessions & JWT tokens for demo recording
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const jwtSecret = process.env.JWT_SECRET || "bms-secret-key-development-2026";

  const adminSession = await prisma.userSession.create({
    data: { userId: admin.id, expiresAt },
  });
  const adminToken = jwt.sign(
    { userId: admin.id, role: admin.role, sessionId: adminSession.id },
    jwtSecret,
    { expiresIn: "24h" }
  );

  const managerSession = await prisma.userSession.create({
    data: { userId: manager.id, expiresAt },
  });
  const managerToken = jwt.sign(
    { userId: manager.id, role: manager.role, sessionId: managerSession.id },
    jwtSecret,
    { expiresIn: "24h" }
  );

  const customerSession = await prisma.userSession.create({
    data: { userId: customer1.id, expiresAt },
  });
  const customerToken = jwt.sign(
    { userId: customer1.id, role: customer1.role, sessionId: customerSession.id },
    jwtSecret,
    { expiresIn: "24h" }
  );

  console.log("=== DEMO DATA READY ===");
  console.log(`Account 1 ID: ${account1.id} (No: ${account1.accountNumber}) - Balance: ₹50,000 (Customer 1)`);
  console.log(`Account 2 ID: ${account2.id} (No: ${account2.accountNumber}) - Balance: ₹10,000 (Customer 2)`);
  console.log("\n=== COPY & PASTE TOKENS FOR THUNDER CLIENT ===");
  console.log("\nCUSTOMER TOKEN (Use for Requests 02-12, 15-16):");
  console.log(customerToken);
  console.log("\nMANAGER TOKEN (Use for Requests 01, 13-14, 20):");
  console.log(managerToken);
  console.log("\nADMIN TOKEN (Use for Requests 17-19, 21):");
  console.log(adminToken);
  console.log("\n==============================================\n");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

