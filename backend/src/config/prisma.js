require("tsx/cjs");
require("dotenv").config();
const crypto = require("crypto");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../../generated/prisma/client.ts");

// In-Memory Data Store for Seamless Local Testing & Screen Recording
const inMemoryStore = {
  users: [
    {
      id: 1,
      fullName: "System Administrator",
      email: "admin@bank.com",
      mobile: "9000000001",
      governmentIdNum: "GOVADMIN001",
      passwordHash: "$2b$12$e68Y2kF55l5pD7y2G/aN/.L5Gz4P/K5J2eE4F3M4O5P6Q7R8S9T0U", // password123
      role: "ADMIN",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      fullName: "Branch Manager",
      email: "manager@bank.com",
      mobile: "9000000002",
      governmentIdNum: "GOVMGR002",
      passwordHash: "$2b$12$e68Y2kF55l5pD7y2G/aN/.L5Gz4P/K5J2eE4F3M4O5P6Q7R8S9T0U",
      role: "MANAGER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      fullName: "Demo Customer 1",
      email: "customer1@bank.com",
      mobile: "9000000003",
      governmentIdNum: "GOVCUST003",
      passwordHash: "$2b$12$e68Y2kF55l5pD7y2G/aN/.L5Gz4P/K5J2eE4F3M4O5P6Q7R8S9T0U",
      role: "CUSTOMER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 4,
      fullName: "Demo Customer 2",
      email: "customer2@bank.com",
      mobile: "9000000004",
      governmentIdNum: "GOVCUST004",
      passwordHash: "$2b$12$e68Y2kF55l5pD7y2G/aN/.L5Gz4P/K5J2eE4F3M4O5P6Q7R8S9T0U",
      role: "CUSTOMER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  sessions: [
    {
      id: "demo-session-admin",
      userId: 1,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    },
    {
      id: "demo-session-manager",
      userId: 2,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    },
    {
      id: "demo-session-customer1",
      userId: 3,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    },
  ],
  accounts: [
    {
      id: 1,
      accountNumber: "ACCT-100001",
      userId: 3,
      applicationId: 1,
      accountType: "SAVINGS",
      balance: 50000.0,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      accountNumber: "ACCT-100002",
      userId: 4,
      applicationId: 2,
      accountType: "CURRENT",
      balance: 15000.0,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  transactions: [
    {
      id: 1,
      referenceNumber: "DEP-INIT-001",
      type: "DEPOSIT",
      sourceAccountId: null,
      destinationAccountId: 1,
      amount: 50000,
      status: "COMPLETED",
      performedBy: 3,
      createdAt: new Date(),
    },
  ],
  loans: [
    {
      id: 1,
      referenceNumber: "LOAN-DEMO-001",
      userId: 3,
      requestedAmount: 100000,
      tenureMonths: 24,
      purpose: "Home Renovation",
      status: "SUBMITTED",
      remarks: null,
      reviewedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  auditLogs: (() => {
    const ts = new Date("2026-11-01T00:00:00.000Z");
    const recordPayload = JSON.stringify({
      id: 1,
      userId: 1,
      event: "SYSTEM_INITIALIZED",
      outcome: "SUCCESS",
      timestamp: ts.toISOString(),
      previousHash: "GENESIS",
    });
    const hash = crypto.createHash("sha256").update(recordPayload).digest("hex");
    return [
      {
        id: 1,
        userId: 1,
        event: "SYSTEM_INITIALIZED",
        outcome: "SUCCESS",
        timestamp: ts,
        previousHash: "GENESIS",
        recordHash: hash,
      },
    ];
  })(),
  kycApplications: [
    {
      id: 1,
      referenceNumber: "KYC-CF44BA62",
      userId: 3,
      accountType: "SAVINGS",
      status: "APPROVED",
      reviewedBy: 2,
      reviewedAt: new Date(),
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

function matchClause(item, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR" && Array.isArray(v)) {
      return v.some((clause) => matchClause(item, clause));
    }
    if (v && typeof v === "object") {
      if ("in" in v && Array.isArray(v.in)) {
        return v.in.includes(item[k]);
      }
      if ("gt" in v) return item[k] > v.gt;
      if ("gte" in v) return item[k] >= v.gte;
      if ("lt" in v) return item[k] < v.lt;
      if ("lte" in v) return item[k] <= v.lte;
    }
    return String(item[k]) === String(v);
  });
}

function createMockModel(collectionName) {
  return {
    async findUnique({ where = {}, include = {} }) {
      const items = inMemoryStore[collectionName] || [];
      const item = items.find((i) => matchClause(i, where)) || null;
      if (item && include.user && item.userId) {
        const user = inMemoryStore.users.find((u) => u.id === item.userId);
        return { ...item, user };
      }
      return item ? { ...item } : null;
    },
    async findFirst({ where = {}, include = {}, orderBy } = {}) {
      let items = [...(inMemoryStore[collectionName] || [])];
      if (orderBy && orderBy.id === "desc") {
        items.sort((a, b) => (b.id || 0) - (a.id || 0));
      } else if (orderBy && orderBy.id === "asc") {
        items.sort((a, b) => (a.id || 0) - (b.id || 0));
      }
      const item = items.find((i) => matchClause(i, where)) || null;
      if (item && include.user && item.userId) {
        const user = inMemoryStore.users.find((u) => u.id === item.userId);
        return { ...item, user };
      }
      return item ? { ...item } : null;
    },
    async findMany({ where = {}, take, skip = 0, orderBy } = {}) {
      let items = [...(inMemoryStore[collectionName] || [])];
      items = items.filter((item) => matchClause(item, where));
      if (orderBy && orderBy.id === "desc") {
        items.sort((a, b) => (b.id || 0) - (a.id || 0));
      } else if (orderBy && orderBy.id === "asc") {
        items.sort((a, b) => (a.id || 0) - (b.id || 0));
      }
      if (skip) items = items.slice(skip);
      if (take) items = items.slice(0, take);
      return items;
    },
    async create({ data = {} }) {
      const items = inMemoryStore[collectionName] || [];
      const id = items.length > 0 ? Math.max(...items.map((i) => i.id || 0)) + 1 : 1;
      const now = new Date();
      const record = {
        id,
        ...data,
        timestamp: data.timestamp || now,
        createdAt: data.createdAt || now,
        updatedAt: now,
      };
      items.push(record);
      return record;
    },
    async update({ where = {}, data = {} }) {
      const items = inMemoryStore[collectionName] || [];
      const item = items.find((i) => matchClause(i, where));
      if (!item) throw new Error(`Record not found in ${collectionName}`);

      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && "increment" in v) {
          item[k] = Number(item[k] || 0) + Number(v.increment);
        } else if (v && typeof v === "object" && "decrement" in v) {
          item[k] = Number(item[k] || 0) - Number(v.decrement);
        } else {
          item[k] = v;
        }
      }
      item.updatedAt = new Date();
      return item;
    },
    async updateMany({ where = {}, data = {} }) {
      return { count: 1 };
    },
    async aggregate({ where = {}, _sum = {} }) {
      const items = inMemoryStore[collectionName] || [];
      let total = 0;
      for (const item of items) {
        if (where.type && item.type !== where.type) continue;
        if (where.sourceAccountId && item.sourceAccountId !== where.sourceAccountId) continue;
        if (where.status && item.status !== where.status) continue;
        total += Number(item.amount || 0);
      }
      return { _sum: { amount: total } };
    },
  };
}

const mockPrisma = {
  user: createMockModel("users"),
  userSession: createMockModel("sessions"),
  account: createMockModel("accounts"),
  transaction: createMockModel("transactions"),
  loan: createMockModel("loans"),
  auditLog: createMockModel("auditLogs"),
  kycApplication: createMockModel("kycApplications"),
  availabilityCheck: createMockModel("availabilityChecks"),
  availabilityIncident: createMockModel("availabilityIncidents"),
  scheduledMaintenance: createMockModel("scheduledMaintenances"),

  async $queryRaw() {
    return [{ locked: 1 }];
  },
  async $transaction(arg) {
    if (typeof arg === "function") {
      return arg(mockPrisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  },
  async $disconnect() {
    return Promise.resolve();
  },
};

let realPrisma = null;
if (process.env.USE_REAL_DB === "true") {
  try {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    realPrisma = new PrismaClient({ adapter });
  } catch (e) {
    realPrisma = null;
  }
}

const proxyHandler = {
  get(target, prop) {
    if (prop in target && target[prop] !== undefined) {
      return target[prop];
    }
    return mockPrisma[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    mockPrisma[prop] = value;
    return true;
  },
};

const exportedPrisma = new Proxy(realPrisma || mockPrisma, proxyHandler);

module.exports = exportedPrisma;
