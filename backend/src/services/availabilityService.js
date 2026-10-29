const prisma = require("../config/prisma");
const BANKING_TIMEZONE = "Asia/Kolkata";
const BANKING_START_HOUR = 9;
const BANKING_END_HOUR = 18;
const AVAILABILITY_TARGET_PERCENT = 99.5;

function isWithinBankingHours(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new Error("A valid date is required");
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANKING_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour").value);
  const minute = Number(parts.find((part) => part.type === "minute").value);
  const minutes = hour * 60 + minute;

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


function getISTDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function getISTOffsetMs(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  const displayedAsUTC = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return displayedAsUTC - date.getTime();
}

function getISTBoundary(date, hour) {
  const { year, month, day } = getISTDateParts(date);

  // Start with the requested wall-clock time interpreted as UTC,
  // then correct it using the timezone offset for that date.
  const wallClock = Date.UTC(year, month - 1, day, hour, 0, 0);
  let boundary = wallClock - getISTOffsetMs(new Date(wallClock));

  // Recheck at the calculated instant to account for timezone offsets.
  boundary = wallClock - getISTOffsetMs(new Date(boundary));

  return new Date(boundary);
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

  // Walk through each IST calendar day, using actual instants for
  // its 09:00 and 18:00 boundaries.
  const firstDay = getISTDateParts(start);
  let day = new Date(Date.UTC(firstDay.year, firstDay.month - 1, firstDay.day));

  while (true) {
    const dayParts = {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
    };

    const dayMarker = new Date(
      Date.UTC(dayParts.year, dayParts.month - 1, dayParts.day)
    );

    const opening = getISTBoundary(dayMarker, BANKING_START_HOUR);
    const closing = getISTBoundary(dayMarker, BANKING_END_HOUR);

    const intervalStart = new Date(
      Math.max(start.getTime(), opening.getTime())
    );
    const intervalEnd = new Date(
      Math.min(end.getTime(), closing.getTime())
    );

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
        (total, interval) =>
          total + interval.end.getTime() - interval.start.getTime(),
        0
      );
    }

    // Stop after the IST calendar date containing the end instant.
    const endParts = getISTDateParts(end);
    if (
      dayParts.year === endParts.year &&
      dayParts.month === endParts.month &&
      dayParts.day === endParts.day
    ) {
      break;
    }

    day.setUTCDate(day.getUTCDate() + 1);
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
