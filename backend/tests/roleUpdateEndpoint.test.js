
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";

const prisma = require("../src/config/prisma");
const authRoutes = require("../src/routes/auth");

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

async function callRoleUpdate({
  role,
  userId = "201",
  tokenRole = "ADMIN",
}) {
  const sessionId = "test-session-100";

  const token = jwt.sign(
    { userId: 100, role: tokenRole, sessionId },
    process.env.JWT_SECRET
  );

  const req = {
    params: { userId },
    body: { role },
    headers: { authorization: `Bearer ${token}` },
  };

  const res = createResponse();

  const originalSessionUpdateMany = prisma.userSession.updateMany;

  prisma.userSession.updateMany = async ({ where }) => ({
    count:
      where.id === sessionId && where.userId === 100 ? 1 : 0,
  });

  try {
    const handler = authRoutes.stack.find(
      (layer) =>
        layer.route?.path === "/role/:userId" &&
        layer.route.methods.patch
    );

    assert.ok(handler, "Role update route should exist");

    const layers = handler.route.stack;

    for (const layer of layers) {
      let nextCalled = false;

      await layer.handle(req, res, () => {
        nextCalled = true;
      });

      if (!nextCalled) {
        break;
      }
    }

    return { res };
  } finally {
    prisma.userSession.updateMany = originalSessionUpdateMany;
  }
}

test("Role update route exists", () => {
  const handler = authRoutes.stack.find(
    (layer) =>
      layer.route?.path === "/role/:userId" &&
      layer.route.methods.patch
  );

  assert.ok(handler);
});

test("Invalid role is rejected", async () => {
  const originalFindUnique = prisma.user.findUnique;

  prisma.user.findUnique = async () => ({
    id: 100,
    role: "ADMIN",
  });

  try {
    const { res } = await callRoleUpdate({ role: "SUPERUSER" });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Role must be/);
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("Invalid user ID is rejected", async () => {
  const originalFindUnique = prisma.user.findUnique;

  prisma.user.findUnique = async () => ({
    id: 100,
    role: "ADMIN",
  });

  try {
    const { res } = await callRoleUpdate({
      role: "TELLER",
      userId: "abc",
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, "Invalid user ID");
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("Non-admin cannot update a user's role", async () => {
  const originalFindUnique = prisma.user.findUnique;

  prisma.user.findUnique = async () => ({
    id: 100,
    role: "CUSTOMER",
  });

  try {
    const { res } = await callRoleUpdate({
      role: "TELLER",
      tokenRole: "CUSTOMER",
    });

    assert.equal(res.statusCode, 403);
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("Nonexistent user is rejected", async () => {
  const originalFindUnique = prisma.user.findUnique;

  prisma.user.findUnique = async ({ where }) => {
    if (where.id === 100) {
      return { id: 100, role: "ADMIN" };
    }

    return null;
  };

  try {
    const { res } = await callRoleUpdate({ role: "TELLER" });

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, "User not found");
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test("Admin can update a user's role and audit the change", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const originalUpdate = prisma.user.update;
  const originalAuditCreate = prisma.auditLog.create;

  const auditEntries = [];

  prisma.user.findUnique = async ({ where }) => {
    if (where.id === 100) {
      return { id: 100, role: "ADMIN" };
    }

    if (where.id === 201) {
      return { id: 201, role: "CUSTOMER" };
    }

    return null;
  };

  prisma.user.update = async ({ where, data }) => ({
    id: where.id,
    role: data.role,
  });

  prisma.auditLog.create = async ({ data }) => {
    auditEntries.push(data);
    return data;
  };

  try {
    const { res } = await callRoleUpdate({ role: "TELLER" });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.id, 201);
    assert.equal(res.body.user.role, "TELLER");

    assert.equal(auditEntries.length, 1);
    assert.equal(auditEntries[0].userId, 100);
    assert.equal(auditEntries[0].event, "ADMIN_ROLE_UPDATED");
    assert.equal(auditEntries[0].outcome, "USER:201;ROLE:TELLER");
  } finally {
    prisma.user.findUnique = originalFindUnique;
    prisma.user.update = originalUpdate;
    prisma.auditLog.create = originalAuditCreate;
  }
});
