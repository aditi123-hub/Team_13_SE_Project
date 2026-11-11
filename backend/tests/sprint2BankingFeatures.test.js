const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
process.env.DATA_ENCRYPTION_KEY = require("crypto").randomBytes(32).toString("base64");

const prisma = require("../src/config/prisma");
const auditLogger = require("../src/services/auditLogger");
const accountRoutes = require("../src/routes/accounts");
const transferRoutes = require("../src/routes/transfers");
const loanRoutes = require("../src/routes/loans");
const statementRoutes = require("../src/routes/statements");
const adminRoutes = require("../src/routes/admin");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function callRouter({ router, path, method = "get", role = "CUSTOMER", body = {}, params = {}, query = {}, userId = 100 }) {
  const sessionId = "sprint2-test-session";
  const token = jwt.sign({ userId, role, sessionId }, process.env.JWT_SECRET);

  const req = {
    method: method.toUpperCase(),
    path,
    params,
    query,
    body,
    headers: { authorization: `Bearer ${token}` },
    user: { id: userId, role, sessionId },
  };

  const res = createResponse();

  const originalSessionUpdateMany = prisma.userSession.updateMany;
  const originalUserFindUnique = prisma.user.findUnique;

  prisma.userSession.updateMany = async () => ({ count: 1 });
  prisma.user.findUnique = async ({ where }) => {
    if (where && where.id) {
      return { id: userId, role, email: "user@example.com" };
    }
    return null;
  };

  try {
    const routeLayer = router.stack.find(
      (layer) => layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]
    );

    assert.ok(routeLayer, `Route ${method.toUpperCase()} ${path} should exist`);

    for (const layer of routeLayer.route.stack) {
      let nextCalled = false;
      let nextError;

      await layer.handle(req, res, (error) => {
        nextCalled = true;
        nextError = error;
      });

      if (nextError) throw nextError;
      if (!nextCalled) break;
    }

    return { res };
  } finally {
    prisma.userSession.updateMany = originalSessionUpdateMany;
    prisma.user.findUnique = originalUserFindUnique;
  }
}

test("Deposit route: successfully records deposit and updates balance", async () => {
  const originalAccountFindUnique = prisma.account.findUnique;
  const originalTransaction = prisma.$transaction;
  const originalAudit = auditLogger.recordAuditLog;

  prisma.account.findUnique = async () => ({
    id: 1,
    userId: 100,
    status: "ACTIVE",
    balance: 500,
  });

  prisma.$transaction = async (queries) => [
    { referenceNumber: "DEP-1234", createdAt: new Date() },
    { id: 1, balance: 1000 },
  ];
  auditLogger.recordAuditLog = async () => {};

  try {
    const { res } = await callRouter({
      router: accountRoutes,
      path: "/:accountId/deposit",
      method: "post",
      params: { accountId: "1" },
      body: { amount: 500 },
      userId: 100,
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.message, "Deposit recorded successfully");
    assert.equal(res.body.receipt.amount, 500);
  } finally {
    prisma.account.findUnique = originalAccountFindUnique;
    prisma.$transaction = originalTransaction;
    auditLogger.recordAuditLog = originalAudit;
  }
});

test("Withdrawal route: rejects if insufficient balance", async () => {
  const originalAccountFindUnique = prisma.account.findUnique;

  prisma.account.findUnique = async () => ({
    id: 1,
    userId: 100,
    status: "ACTIVE",
    balance: 200,
  });

  try {
    const { res } = await callRouter({
      router: accountRoutes,
      path: "/:accountId/withdraw",
      method: "post",
      params: { accountId: "1" },
      body: { amount: 500 },
      userId: 100,
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /insufficient balance/i);
  } finally {
    prisma.account.findUnique = originalAccountFindUnique;
  }
});

test("Loan application route: submits loan with SUBMITTED status", async () => {
  const originalLoanCreate = prisma.loan.create;
  const originalAudit = auditLogger.recordAuditLog;

  prisma.loan.create = async ({ data }) => ({
    id: 1,
    referenceNumber: data.referenceNumber,
    requestedAmount: data.requestedAmount,
    tenureMonths: data.tenureMonths,
    status: "SUBMITTED",
  });
  auditLogger.recordAuditLog = async () => {};

  try {
    const { res } = await callRouter({
      router: loanRoutes,
      path: "/apply",
      method: "post",
      body: { amount: 25000, purpose: "Education" },
      userId: 100,
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.status, "SUBMITTED");
    assert.equal(res.body.requestedAmount, 25000);
  } finally {
    prisma.loan.create = originalLoanCreate;
    auditLogger.recordAuditLog = originalAudit;
  }
});

test("Mini statement route: returns last 10 transactions with direction", async () => {
  const originalAccountFindUnique = prisma.account.findUnique;
  const originalTransactionFindMany = prisma.transaction.findMany;

  prisma.account.findUnique = async () => ({
    id: 1,
    userId: 100,
    balance: 1500,
    accountType: "SAVINGS",
  });

  prisma.transaction.findMany = async () => [
    {
      referenceNumber: "DEP-1",
      type: "DEPOSIT",
      sourceAccountId: null,
      destinationAccountId: 1,
      amount: 1000,
      status: "COMPLETED",
      createdAt: new Date(),
    },
    {
      referenceNumber: "TXN-1",
      type: "TRANSFER",
      sourceAccountId: 1,
      destinationAccountId: 2,
      amount: 200,
      status: "COMPLETED",
      createdAt: new Date(),
    },
  ];

  try {
    const { res } = await callRouter({
      router: statementRoutes,
      path: "/:accountId/mini",
      method: "get",
      params: { accountId: "1" },
      userId: 100,
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.transactions.length, 2);
    assert.equal(res.body.transactions[0].direction, "CREDIT");
    assert.equal(res.body.transactions[1].direction, "DEBIT");
  } finally {
    prisma.account.findUnique = originalAccountFindUnique;
    prisma.transaction.findMany = originalTransactionFindMany;
  }
});

test("Transfer route: low-value transfer completes directly", async () => {
  const originalAccountFindUnique = prisma.account.findUnique;
  const originalTransactionAggregate = prisma.transaction.aggregate;
  const originalTransaction = prisma.$transaction;
  const originalAudit = auditLogger.recordAuditLog;

  prisma.account.findUnique = async ({ where }) => {
    if (where.id === 1) return { id: 1, userId: 100, status: "ACTIVE", balance: 5000 };
    if (where.id === 2) return { id: 2, userId: 101, status: "ACTIVE", balance: 1000 };
    return null;
  };

  prisma.transaction.aggregate = async () => ({ _sum: { amount: 0 } });
  prisma.$transaction = async () => [
    { referenceNumber: "TXN-TEST-123" },
    { id: 1, balance: 4000 },
    { id: 2, balance: 2000 },
  ];
  auditLogger.recordAuditLog = async () => {};

  try {
    const { res } = await callRouter({
      router: transferRoutes,
      path: "/initiate",
      method: "post",
      body: { fromAccountId: 1, toAccountId: 2, amount: 1000 },
      userId: 100,
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Transfer completed successfully");
    assert.equal(res.body.amount, 1000);
  } finally {
    prisma.account.findUnique = originalAccountFindUnique;
    prisma.transaction.aggregate = originalTransactionAggregate;
    prisma.$transaction = originalTransaction;
    auditLogger.recordAuditLog = originalAudit;
  }
});

test("Admin create user route: creates a new user successfully", async () => {
  const originalUserFindUnique = prisma.user.findUnique;
  const originalUserCreate = prisma.user.create;
  const originalAudit = auditLogger.recordAuditLog;

  prisma.user.findUnique = async ({ where }) => {
    if (where.id === 999) return { id: 999, role: "ADMIN" };
    if (where.email) return null;
    return null;
  };

  prisma.user.create = async ({ data }) => ({
    id: 105,
    fullName: data.fullName,
    email: data.email,
    mobile: data.mobile,
    role: data.role,
    createdAt: new Date(),
  });
  auditLogger.recordAuditLog = async () => {};

  try {
    const { res } = await callRouter({
      router: adminRoutes,
      path: "/users",
      method: "post",
      role: "ADMIN",
      userId: 999,
      body: {
        fullName: "Test Teller",
        email: "teller@bank.com",
        password: "password123",
        role: "TELLER",
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.message, "User account created successfully");
    assert.equal(res.body.user.role, "TELLER");
  } finally {
    prisma.user.findUnique = originalUserFindUnique;
    prisma.user.create = originalUserCreate;
    auditLogger.recordAuditLog = originalAudit;
  }
});
