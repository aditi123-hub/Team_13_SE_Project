
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RETENTION_YEARS,
  getRetentionCutoff,
  isWithinRetentionPeriod,
} = require("../src/config/auditRetention");

test("audit logs must have a minimum retention period of five years", () => {
  assert.equal(RETENTION_YEARS, 5);
});

test("calculates the retention cutoff five years before the current date", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");

  assert.equal(
    getRetentionCutoff(now).toISOString(),
    "2021-10-27T12:00:00.000Z"
  );
});

test("identifies a recent audit log as within the retention period", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  const recentTimestamp = new Date("2024-01-01T00:00:00.000Z");

  assert.equal(isWithinRetentionPeriod(recentTimestamp, now), true);
});

test("identifies a log older than five years as outside the retention period", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  const oldTimestamp = new Date("2021-01-01T00:00:00.000Z");

  assert.equal(isWithinRetentionPeriod(oldTimestamp, now), false);
});

test("rejects invalid audit timestamps", () => {
  assert.throws(
    () => isWithinRetentionPeriod("not-a-date"),
    { name: "TypeError", message: "A valid audit timestamp is required" }
  );
});
test("a record exactly at the five-year cutoff is outside the retention period", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  const cutoff = new Date("2021-10-27T12:00:00.000Z");

  assert.equal(isWithinRetentionPeriod(cutoff, now), false);
});