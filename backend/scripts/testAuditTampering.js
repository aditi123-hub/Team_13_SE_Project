
const { calculateHash } = require("../src/services/auditLogger");

const originalRecord = {
  id: 1,
  userId: 10,
  event: "LOGIN",
  outcome: "SUCCESS",
  timestamp: new Date("2026-10-26T10:00:00.000Z"),
  previousHash: "GENESIS",
};

const originalHash = calculateHash(originalRecord);

// Simulate someone changing the outcome after the hash was generated.
const tamperedRecord = {
  ...originalRecord,
  outcome: "FAILED",
};

const tamperedHash = calculateHash(tamperedRecord);

if (originalHash !== tamperedHash) {
  console.log("PASS: Tampering detected — hashes do not match.");
} else {
  console.error("FAIL: Tampering was not detected.");
  process.exitCode = 1;
}
