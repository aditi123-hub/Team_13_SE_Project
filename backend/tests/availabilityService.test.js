const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isWithinBankingHours,
  calculateAvailability,
  calculateEligibleTime,
  calculateMonthlyAvailability,
  AVAILABILITY_TARGET_PERCENT,
} = require("../src/services/availabilityService");

test("Banking hours include 09:00 and exclude 18:00", () => {
  assert.equal(isWithinBankingHours(new Date(2026, 9, 29, 9, 0)), true);
  assert.equal(isWithinBankingHours(new Date(2026, 9, 29, 17, 59)), true);
  assert.equal(isWithinBankingHours(new Date(2026, 9, 29, 18, 0)), false);
  assert.equal(isWithinBankingHours(new Date(2026, 9, 29, 8, 59)), false);
});
test("Banking hours are evaluated in IST regardless of server timezone", () => {
  // 03:30 UTC is 09:00 IST — banking hours should include it.
  assert.equal(
    isWithinBankingHours(new Date("2026-10-29T03:30:00.000Z")),
    true
  );

  // 12:30 UTC is 18:00 IST — banking hours should exclude it.
  assert.equal(
    isWithinBankingHours(new Date("2026-10-29T12:30:00.000Z")),
    false
  );
});

test("Availability meets the 99.5% target when downtime is 0.5%", () => {
  const result = calculateAvailability({
    totalEligibleMs: 200_000,
    downtimeMs: 1_000,
  });

  assert.equal(result.availabilityPercent, 99.5);
  assert.equal(result.meetsTarget, true);
});

test("Availability fails when downtime exceeds the 0.5% budget", () => {
  const result = calculateAvailability({
    totalEligibleMs: 200_000,
    downtimeMs: 1_002,
  });

  assert.ok(result.availabilityPercent < AVAILABILITY_TARGET_PERCENT);
  assert.equal(result.meetsTarget, false);
});

test("Zero eligible time returns no availability percentage", () => {
  const result = calculateAvailability({
    totalEligibleMs: 0,
    downtimeMs: 0,
  });

  assert.equal(result.availabilityPercent, null);
  assert.equal(result.meetsTarget, null);
});

test("Invalid time values are rejected", () => {
  assert.throws(
    () => calculateAvailability({
      totalEligibleMs: 100,
      downtimeMs: 101,
    }),
    /Invalid availability time values/
  );

  assert.throws(
    () => calculateAvailability({
      totalEligibleMs: -1,
      downtimeMs: 0,
    }),
    /Invalid availability time values/
  );
});
test("Eligible time excludes hours outside banking hours", () => {
  const eligible = calculateEligibleTime(
    new Date(2026, 9, 29, 8, 0),
    new Date(2026, 9, 29, 19, 0)
  );

  assert.equal(eligible, 9 * 60 * 60 * 1000);
});
test("Eligible time uses IST banking-hour boundaries", () => {
  const start = new Date("2026-10-29T00:00:00.000Z");
  const end = new Date("2026-10-30T00:00:00.000Z");

  const eligibleMs = calculateEligibleTime(start, end);

  // 09:00–18:00 IST is 9 hours per day.
  assert.equal(eligibleMs, 9 * 60 * 60 * 1000);
});
test("Scheduled maintenance is excluded from eligible time", () => {
  const eligible = calculateEligibleTime(
    new Date(2026, 9, 29, 9, 0),
    new Date(2026, 9, 29, 18, 0),
    [{
      start: new Date(2026, 9, 29, 12, 0),
      end: new Date(2026, 9, 29, 13, 0),
    }]
  );

  assert.equal(eligible, 8 * 60 * 60 * 1000);
});

test("Maintenance outside banking hours does not change eligible time", () => {
  const eligible = calculateEligibleTime(
    new Date(2026, 9, 29, 9, 0),
    new Date(2026, 9, 29, 18, 0),
    [{
      start: new Date(2026, 9, 29, 20, 0),
      end: new Date(2026, 9, 29, 21, 0),
    }]
  );

  assert.equal(eligible, 9 * 60 * 60 * 1000);
});

test("Monthly availability uses eligible time after maintenance exclusions", () => {
  const result = calculateMonthlyAvailability({
    start: new Date(2026, 9, 29, 9, 0),
    end: new Date(2026, 9, 29, 18, 0),
    downtimeMs: 1 * 60 * 1000,
    maintenanceWindows: [{
      start: new Date(2026, 9, 29, 12, 0),
      end: new Date(2026, 9, 29, 13, 0),
    }],
  });

  assert.equal(result.totalEligibleMs, 8 * 60 * 60 * 1000);
  assert.equal(result.meetsTarget, true);
});

test("Invalid date ranges are rejected", () => {
  assert.throws(
    () => calculateEligibleTime(
      new Date(2026, 9, 29, 18, 0),
      new Date(2026, 9, 29, 9, 0)
    ),
    /valid start date/
  );
});
