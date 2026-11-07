
const RETENTION_YEARS = 5;

function getRetentionCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RETENTION_YEARS);
  return cutoff;
}

function isWithinRetentionPeriod(timestamp, now = new Date()) {
  const recordedAt = new Date(timestamp);

  if (Number.isNaN(recordedAt.getTime())) {
    throw new TypeError("A valid audit timestamp is required");
  }

  return recordedAt > getRetentionCutoff(now);
}

module.exports = {
  RETENTION_YEARS,
  getRetentionCutoff,
  isWithinRetentionPeriod,
};
