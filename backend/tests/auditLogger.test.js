
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateHash } = require("../src/services/auditLogger");

const originalRecord = {
  id: 1,
  userId: 10,
  event: "LOGIN_ATTEMPT",
  outcome: "SUCCESS",
  timestamp: new Date("2026-10-26T10:00:00.000Z"),
  previousHash: "GENESIS",
};

test("Audit record hash is deterministic", () => {
  assert.equal(
    calculateHash(originalRecord),
    calculateHash(originalRecord)
  );
});

test("Changing the outcome changes the hash", () => {
  const originalHash = calculateHash(originalRecord);
  const tamperedHash = calculateHash({
    ...originalRecord,
    outcome: "FAILURE",
  });

  assert.notEqual(originalHash, tamperedHash);
});

test("Changing the user ID changes the hash", () => {
  assert.notEqual(
    calculateHash(originalRecord),
    calculateHash({ ...originalRecord, userId: 11 })
  );
});

test("Changing the previous hash changes the hash", () => {
  assert.notEqual(
    calculateHash(originalRecord),
    calculateHash({ ...originalRecord, previousHash: "different-hash" })
  );
});

test("Changing the timestamp changes the hash", () => {
  assert.notEqual(
    calculateHash(originalRecord),
    calculateHash({
      ...originalRecord,
      timestamp: new Date("2026-10-26T10:01:00.000Z"),
    })
  );
});
