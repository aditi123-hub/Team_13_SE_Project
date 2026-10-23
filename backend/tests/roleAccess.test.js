
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const prisma = require("../src/config/prisma");
const {
  requireRole,
} = require("../src/middleware/authMiddleware");

process.env.JWT_SECRET = "test-secret";

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

async function checkRole(userId, actualRole, allowedRoles) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET);
  const req = {
    headers: { authorization: `Bearer ${token}` },
  };
  const res = createResponse();
  const originalFindUnique = prisma.user.findUnique;

  prisma.user.findUnique = async () => ({
    id: userId,
    role: actualRole,
  });

  let nextCalled = false;

  try {
    await requireRole(...allowedRoles)(req, res, () => {
      nextCalled = true;
    });

    return { req, res, nextCalled };
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
}

test("Customer is forbidden from Admin-only access", async () => {
  const result = await checkRole(101, "CUSTOMER", ["ADMIN"]);

  assert.equal(result.res.statusCode, 403);
  assert.equal(result.nextCalled, false);
});

test("Admin is allowed to access Admin-only resources", async () => {
  const result = await checkRole(102, "ADMIN", ["ADMIN"]);

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.role, "ADMIN");
});

test("Teller is forbidden from Manager-only access", async () => {
  const result = await checkRole(103, "TELLER", ["MANAGER", "ADMIN"]);

  assert.equal(result.res.statusCode, 403);
  assert.equal(result.nextCalled, false);
});

test("Manager is allowed to access Manager-only resources", async () => {
  const result = await checkRole(104, "MANAGER", ["MANAGER", "ADMIN"]);

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.role, "MANAGER");
});

test("Missing token is rejected", async () => {
  const req = { headers: {} };
  const res = createResponse();

  let nextCalled = false;

  await requireRole("ADMIN")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("Invalid token is rejected", async () => {
  const req = {
    headers: { authorization: "Bearer invalid-token" },
  };
  const res = createResponse();

  let nextCalled = false;

  await requireRole("ADMIN")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});
