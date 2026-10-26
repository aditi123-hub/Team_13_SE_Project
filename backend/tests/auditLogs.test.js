
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";

const prisma = require("../src/config/prisma");
const auditLogRoutes = require("../src/routes/auditLogs");

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

async function callAuditLogs({ tokenRole = "ADMIN", noToken = false, query = {} } = {}) {
  const sessionId = "test-audit-session";

  const req = {
    query,
    headers: noToken
      ? {}
      : {
          authorization: `Bearer ${jwt.sign(
            { userId: 100, role: tokenRole, sessionId },
            process.env.JWT_SECRET
          )}`,
        },
  };

  const res = createResponse();
  const originalSessionUpdateMany = prisma.userSession.updateMany;
  const originalFindMany = prisma.auditLog.findMany;
  const originalCount = prisma.auditLog.count;
const originalUserFindUnique = prisma.user.findUnique;

  prisma.userSession.updateMany = async ({ where }) => ({
    count: where.id === sessionId && where.userId === 100 ? 1 : 0,
  });
prisma.user.findUnique = async ({ where }) => {
  if (where.id === 100) {
    return {
      id: 100,
      role: tokenRole,
    };
  }

  return null;
};

  prisma.auditLog.findMany = async () => [
    {
      id: 2,
      userId: 100,
      event: "LOGIN_ATTEMPT",
      outcome: "SUCCESS",
      timestamp: new Date("2026-10-26T08:00:00Z"),
      previousHash: "previous-hash",
      recordHash: "record-hash",
    },
  ];

  prisma.auditLog.count = async () => 1;

  try {
    const handler = auditLogRoutes.stack.find(
      (layer) =>
        layer.route?.path === "/" &&
        layer.route.methods.get
    );

    assert.ok(handler, "Audit-log GET route should exist");

    for (const layer of handler.route.stack) {
      let nextCalled = false;

      await layer.handle(req, res, () => {
        nextCalled = true;
      });

      if (!nextCalled) break;
    }

    return res;
  } finally {
    prisma.userSession.updateMany = originalSessionUpdateMany;
    prisma.auditLog.findMany = originalFindMany;
    prisma.auditLog.count = originalCount;
prisma.user.findUnique = originalUserFindUnique;
  }
}

test("Audit-log GET route exists", () => {
  const handler = auditLogRoutes.stack.find(
    (layer) => layer.route?.path === "/" && layer.route.methods.get
  );

  assert.ok(handler);
});

test("Admin can view audit logs", async () => {
  const res = await callAuditLogs();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.logs.length, 1);
  assert.equal(res.body.logs[0].event, "LOGIN_ATTEMPT");
  assert.equal(res.body.pagination.total, 1);
});

test("Non-admin cannot view audit logs", async () => {
  const res = await callAuditLogs({ tokenRole: "CUSTOMER" });

  assert.equal(res.statusCode, 403);
});

test("Unauthenticated request is rejected", async () => {
  const res = await callAuditLogs({ noToken: true });

  assert.equal(res.statusCode, 401);
});

test("Pagination parameters are accepted", async () => {
  const res = await callAuditLogs({
    query: { limit: "10", offset: "5" },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pagination.limit, 10);
  assert.equal(res.body.pagination.offset, 5);
});
