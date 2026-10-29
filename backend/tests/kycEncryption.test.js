const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";

const prisma = require("../src/config/prisma");
const auditLogger = require("../src/services/auditLogger");
const { encryptData, decryptData } = require("../src/services/dataEncryption");
const kycRoutes = require("../src/routes/kyc");

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

async function callRoute({ path, method = "get", role = "MANAGER", body = {}, userId = 100 }) {
  const sessionId = "kyc-test-session";
  const token = jwt.sign(
    { userId, role, sessionId },
    process.env.JWT_SECRET
  );

  const req = {
    method: method.toUpperCase(),
    path,
    params: path === "/review/:id" ? { id: "1" } : {},
    query: {},
    body,
    headers: { authorization: `Bearer ${token}` },
  };

  const res = createResponse();

  const originalSessionUpdateMany = prisma.userSession.updateMany;
  const originalUserFindUnique = prisma.user.findUnique;

  prisma.userSession.updateMany = async () => ({ count: 1 });
  prisma.user.findUnique = async () => ({ id: userId, role });

  try {
    const routeLayer = kycRoutes.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === path &&
        layer.route.methods[method]
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

test("KYC application stores document values encrypted", async () => {
  const originalFindFirst = prisma.kycApplication.findFirst;
  const originalCreate = prisma.kycApplication.create;
  const originalAudit = auditLogger.recordAuditLog;

  let savedData;
  prisma.kycApplication.findFirst = async () => null;
  prisma.kycApplication.create = async ({ data }) => {
    savedData = data;
    return { id: 1, referenceNumber: "KYC-TEST-1", status: "PENDING", accountType: data.accountType };
  };
  auditLogger.recordAuditLog = async () => {};

  try {
    const { res } = await callRoute({
      path: "/apply",
      method: "post",
      role: "CUSTOMER",
      body: {
        accountType: "SAVINGS",
        documents: [{ documentType: "PAN", documentValue: "ABCDE1234F" }],
      },
    });

    assert.equal(res.statusCode, 201);
    assert.ok(savedData, "KYC application should be created");

    const storedValue = savedData.documents.create[0].documentValue;
    assert.notEqual(storedValue, "ABCDE1234F");
    assert.match(storedValue, /^enc-v1:/);
    assert.equal(decryptData(storedValue), "ABCDE1234F");
  } finally {
    prisma.kycApplication.findFirst = originalFindFirst;
    prisma.kycApplication.create = originalCreate;
    auditLogger.recordAuditLog = originalAudit;
  }
});

test("Manager pending KYC route decrypts document values", async () => {
  const originalFindMany = prisma.kycApplication.findMany;

  prisma.kycApplication.findMany = async () => [{
    id: 1,
    referenceNumber: "KYC-TEST-1",
    status: "PENDING",
    documents: [{
      id: 10,
      documentType: "PAN",
      documentValue: encryptData("ABCDE1234F"),
    }],
  }];

  try {
    const { res } = await callRoute({ path: "/pending", role: "MANAGER" });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.applications[0].documents[0].documentValue, "ABCDE1234F");
  } finally {
    prisma.kycApplication.findMany = originalFindMany;
  }
});

test("Manager KYC review route decrypts document values", async () => {
  const originalFindUnique = prisma.kycApplication.findUnique;

  prisma.kycApplication.findUnique = async () => ({
    id: 1,
    referenceNumber: "KYC-TEST-1",
    status: "PENDING",
    documents: [{
      id: 10,
      documentType: "PAN",
      documentValue: encryptData("ABCDE1234F"),
    }],
  });

  try {
    const { res } = await callRoute({
      path: "/review/:id",
      role: "MANAGER",
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.documents[0].documentValue, "ABCDE1234F");
  } finally {
    prisma.kycApplication.findUnique = originalFindUnique;
  }
});

test("Customer cannot access pending KYC applications", async () => {
  const { res } = await callRoute({ path: "/pending", role: "CUSTOMER" });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "Manager access required");
});

test("Customer cannot access KYC review route", async () => {
  const { res } = await callRoute({
    path: "/review/:id",
    role: "CUSTOMER",
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "Manager access required");
});
