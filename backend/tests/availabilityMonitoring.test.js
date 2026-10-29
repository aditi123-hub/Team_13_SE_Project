
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/config/prisma");
const {
  recordHealthCheck,
  getMonthlyAvailability,
} = require("../src/services/availabilityService");

const createdCheckIds = [];
const createdIncidentIds = [];

async function cleanupTestRecords() {
  if (createdIncidentIds.length) {
    await prisma.availabilityIncident.deleteMany({
      where: { id: { in: createdIncidentIds } },
    });
  }

  if (createdCheckIds.length) {
    await prisma.availabilityCheck.deleteMany({
      where: { id: { in: createdCheckIds } },
    });
  }
}

after(async () => {
  await cleanupTestRecords();
  await prisma.$disconnect();
});

test("records a healthy health check", async () => {
  const check = await recordHealthCheck({
    isHealthy: true,
    responseTimeMs: 25,
    statusCode: 200,
  });

  createdCheckIds.push(check.id);

  assert.equal(check.isHealthy, true);
  assert.equal(check.responseTimeMs, 25);
  assert.equal(check.statusCode, 200);
});

test("opens an incident on a failed health check", async () => {
  const check = await recordHealthCheck({
    isHealthy: false,
    statusCode: 503,
    reason: "Test outage",
  });

  createdCheckIds.push(check.id);

  const incidents = await prisma.availabilityIncident.findMany({
    where: { reason: "Test outage" },
    orderBy: { id: "desc" },
    take: 1,
  });

  assert.equal(incidents.length, 1);
  createdIncidentIds.push(incidents[0].id);
  assert.equal(incidents[0].recoveredAt, null);
});

test("monthly report returns an availability percentage", async () => {
  const start = new Date("2026-10-01T00:00:00+05:30");
  const end = new Date("2026-11-01T00:00:00+05:30");

  const report = await getMonthlyAvailability({ start, end });

  assert.ok(report.totalEligibleMs > 0);
  assert.equal(report.targetPercent, 99.5);
  assert.ok(
    report.availabilityPercent === null ||
      (report.availabilityPercent >= 0 &&
        report.availabilityPercent <= 100)
  );
});
