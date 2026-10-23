
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";

const prisma = require("../src/config/prisma");
const { requireAdmin } = require("../src/middleware/authMiddleware");

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

test("Non-admin cannot pass admin authorization", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const token = jwt.sign({ userId: 101 }, process.env.JWT_SECRET);

  prisma.user.findUnique = async () => ({
    id: 101,
    role: "CUSTOMER",
  });

  const req = {
    headers: { authorization: `Bearer ${token}` },
  };
  const res = createResponse();
  let nextCalled = false;

  try {
    await requireAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("Admin passes authorization and is attached to request", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const token = jwt.sign({ userId: 102 }, process.env.JWT_SECRET);

  prisma.user.findUnique = async () => ({
    id: 102,
    role: "ADMIN",
  });

  const req = {
    headers: { authorization: `Bearer ${token}` },
  };
  const res = createResponse();
  let nextCalled = false;

  try {
    await requireAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 102);
    assert.equal(req.user.role, "ADMIN");
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});
