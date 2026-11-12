const assert = require("assert");
const { calculateEntryHash, verifyAuditChain } = require("../src/utils/auditChainValidator");

console.log("--> Running Audit Chain Integrity Test Suite (BMS-SR-004)...");

// Test 1: Empty chain should pass
const emptyRes = verifyAuditChain([]);
assert.strictEqual(emptyRes.valid, true, "Empty chain should validate");

// Test 2: Sequential valid entries
const t0 = new Date("2026-11-12T00:00:00Z").toISOString();
const h0 = calculateEntryHash("GENESIS_BLOCK", "USER_REGISTER", 1, { email: "alice@test.com" }, t0);

const t1 = new Date("2026-11-12T00:01:00Z").toISOString();
const h1 = calculateEntryHash(h0, "FUNDS_TRANSFER", 1, { amount: 5000, recipient: 2 }, t1);

const validLogs = [
  { id: 1, action: "USER_REGISTER", userId: 1, previousHash: "GENESIS_BLOCK", hash: h0, timestamp: t0 },
  { id: 2, action: "FUNDS_TRANSFER", userId: 1, previousHash: h0, hash: h1, timestamp: t1 },
];

const validRes = verifyAuditChain(validLogs);
assert.strictEqual(validRes.valid, true, "Valid sequential chain must pass");
assert.strictEqual(validRes.count, 2, "Should verify 2 blocks");

// Test 3: Tampered chain detection
const tamperedLogs = [
  { id: 1, action: "USER_REGISTER", userId: 1, previousHash: "GENESIS_BLOCK", hash: h0, timestamp: t0 },
  { id: 2, action: "FUNDS_TRANSFER", userId: 1, previousHash: "TAMPERED_HASH", hash: h1, timestamp: t1 },
];

const invalidRes = verifyAuditChain(tamperedLogs);
assert.strictEqual(invalidRes.valid, false, "Tampered chain must be rejected");
assert.strictEqual(invalidRes.brokenIndex, 1, "Should pinpoint broken index");

console.log(" Audit Chain Integrity tests passed 100%!");
