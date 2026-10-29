const prisma = require("../config/prisma");
const BANKING_START_HOUR = 9;
const BANKING_END_HOUR = 18;
const AVAILABILITY_TARGET_PERCENT = 99.5;

function isWithinBankingHours(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();

  return (
    minutes >= BANKING_START_HOUR * 60 &&
    minutes < BANKING_END_HOUR * 60
  );
}

function calculateAvailability({ totalEligibleMs, downtimeMs }) {
  if (
    !Number.isFinite(totalEligibleMs) ||
    !Number.isFinite(downtimeMs) ||
    totalEligibleMs < 0 ||
    downtimeMs < 0 ||
    downtimeMs > totalEligibleMs
  ) {
    throw new Error("Invalid availability time values");
  }

  if (totalEligibleMs === 0) {
    return { availabilityPercent: null, meetsTarget: null };
  }

  const availabilityPercent =
    ((totalEligibleMs - downtimeMs) / totalEligibleMs) * 100;

  return {
    availabilityPercent,
    meetsTarget: availabilityPercent >= AVAILABILITY_TARGET_PERCENT,
  };
}

function calculateEligibleTime(start, end, maintenanceWindows = []) {
  if (
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  ) {
    throw new Error("A valid start date before the end date is required");
  }

  const windows = maintenanceWindows.map((window) => {
    const maintenanceStart = new Date(window.start);
    const maintenanceEnd = new Date(window.end);

    if (
      !Number.isFinite(maintenanceStart.getTime()) ||
      !Number.isFinite(maintenanceEnd.getTime()) ||
      maintenanceStart >= maintenanceEnd
    ) {
      throw new Error("Invalid scheduled maintenance window");
    }

    return { start: maintenanceStart, end: maintenanceEnd };
  });

  let eligibleMs = 0;
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);

  while (day < end) {
    const opening = new Date(day);
    opening.setHours(BANKING_START_HOUR, 0, 0, 0);

    const closing = new Date(day);
    closing.setHours(BANKING_END_HOUR, 0, 0, 0);

    const intervalStart = new Date(Math.max(start.getTime(), opening.getTime()));
    const intervalEnd = new Date(Math.min(end.getTime(), closing.getTime()));

    if (intervalStart < intervalEnd) {
      let intervals = [{ start: intervalStart, end: intervalEnd }];

      for (const maintenance of windows) {
        const remaining = [];

        for (const interval of intervals) {
          if (
            maintenance.end <= interval.start ||
            maintenance.start >= interval.end
          ) {
            remaining.push(interval);
            continue;
          }

          if (maintenance.start > interval.start) {
            remaining.push({
              start: interval.start,
              end: maintenance.start,
            });
          }

          if (maintenance.end < interval.end) {
            remaining.push({
              start: maintenance.end,
              end: interval.end,
            });
          }
        }

        intervals = remaining;
      }

      eligibleMs += intervals.reduce(
        (total, interval) => total + interval.end.getTime() - interval.start.getTime(),
        0
      );
    }

    day.setDate(day.getDate() + 1);
  }

  return eligibleMs;
}

function calculateMonthlyAvailability({
  start,
  end,
  downtimeMs,
  maintenanceWindows = [],
}) {
  const totalEligibleMs = calculateEligibleTime(
    new Date(start),
    new Date(end),
    maintenanceWindows
  );

  return {
    totalEligibleMs,
    ...calculateAvailability({ totalEligibleMs, downtimeMs }),
  };
}
async function recordHealthCheck({
  isHealthy,
  responseTimeMs = null,
  statusCode = null,
  reason = null,
}) {
  if (typeof isHealthy !== "boolean") {
    throw new Error("isHealthy must be a boolean");
  }

  if (
    responseTimeMs !== null &&
    (!Number.isInteger(responseTimeMs) || responseTimeMs < 0)
  ) {
    throw new Error("responseTimeMs must be a non-negative integer or null");
  }

  if (
    statusCode !== null &&
    (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599)
  ) {
    throw new Error("statusCode must be a valid HTTP status code or null");
  }

  return prisma.$transaction(async (tx) => {
    const check = await tx.availabilityCheck.create({
      data: { isHealthy, responseTimeMs, statusCode },
    });

    const openIncident = await tx.availabilityIncident.findFirst({
      where: { recoveredAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (!isHealthy && !openIncident) {
      await tx.availabilityIncident.create({
        data: { startedAt: check.checkedAt, reason },
      });
    } else if (isHealthy && openIncident) {
      await tx.availabilityIncident.update({
        where: { id: openIncident.id },
        data: { recoveredAt: check.checkedAt },
      });
    }

    return check;
  });
}

async function getMonthlyAvailability({ start, end }) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    startDate >= endDate
  ) {
    throw new Error("A valid start date before the end date is required");
  }

  const maintenance = await prisma.scheduledMaintenance.findMany({
    where: {
      startAt: { lt: endDate },
      endAt: { gt: startDate },
    },
    select: { startAt: true, endAt: true },
  });

  const maintenanceWindows = maintenance.map((window) => ({
    start: window.startAt,
    end: window.endAt,
  }));

  const incidents = await prisma.availabilityIncident.findMany({
    where: {
      startedAt: { lt: endDate },
      OR: [
        { recoveredAt: null },
        { recoveredAt: { gt: startDate } },
      ],
    },
    select: { startedAt: true, recoveredAt: true },
  });

  // Clip incidents to the reporting period.
  const outageIntervals = incidents
    .map((incident) => ({
      start: Math.max(
        startDate.getTime(),
        incident.startedAt.getTime()
      ),
      end: Math.min(
        endDate.getTime(),
        (incident.recoveredAt || new Date()).getTime()
      ),
    }))
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping outages to avoid counting downtime twice.
  const mergedOutages = [];

  for (const interval of outageIntervals) {
    const previous = mergedOutages[mergedOutages.length - 1];

    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      mergedOutages.push({ ...interval });
    }
  }

  // Count outage time only during eligible banking hours,
  // excluding scheduled maintenance.
  const downtimeMs = mergedOutages.reduce(
    (total, outage) =>
      total +
      calculateEligibleTime(
        new Date(outage.start),
        new Date(outage.end),
        maintenanceWindows
      ),
    0
  );

  const totalEligibleMs = calculateEligibleTime(
    startDate,
    endDate,
    maintenanceWindows
  );

  return {
    totalEligibleMs,
    downtimeMs,
    ...calculateAvailability({ totalEligibleMs, downtimeMs }),
    targetPercent: AVAILABILITY_TARGET_PERCENT,
  };
}
module.exports = {
  BANKING_START_HOUR,
  BANKING_END_HOUR,
  AVAILABILITY_TARGET_PERCENT,
  isWithinBankingHours,
  calculateAvailability,
  calculateEligibleTime,
  calculateMonthlyAvailability,
  recordHealthCheck,
getMonthlyAvailability,
};
