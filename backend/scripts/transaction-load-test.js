
const { performance } = require("node:perf_hooks");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TOKEN = process.env.TOKEN;
const RECIPIENT_ACCOUNT_ID = process.env.RECIPIENT_ACCOUNT_ID;
const AMOUNT = Number(process.env.AMOUNT || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const REQUESTS = Number(process.env.REQUESTS || 50);
const P90_TARGET_MS = 3000;

function percentile(values, percentileValue) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(percentileValue * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

async function main() {
  if (!TOKEN || !RECIPIENT_ACCOUNT_ID) {
    console.error(
      "Set TOKEN and RECIPIENT_ACCOUNT_ID environment variables first."
    );
    process.exitCode = 1;
    return;
  }

  if (
    !Number.isInteger(CONCURRENCY) ||
    CONCURRENCY < 1 ||
    !Number.isInteger(REQUESTS) ||
    REQUESTS < 1 ||
    !Number.isFinite(AMOUNT) ||
    AMOUNT <= 0 ||
    AMOUNT >= 10000
  ) {
    console.error(
      "Use positive integer concurrency/request counts and an amount between 0 and 10000."
    );
    process.exitCode = 1;
    return;
  }

  const latencies = [];
  const errors = [];
  let completed = 0;
  let successful = 0;
  let nextRequest = 0;

  console.log(`Target: ${BASE_URL}/transfers/initiate`);
  console.log(`Requests: ${REQUESTS}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Amount: ${AMOUNT}`);
  console.log("Starting benchmark...");

  const startedAt = performance.now();

  async function worker() {
    while (true) {
      const requestNumber = nextRequest++;
      if (requestNumber >= REQUESTS) return;

      const requestStartedAt = performance.now();

      try {
        const response = await fetch(`${BASE_URL}/transfers/initiate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toAccountId: RECIPIENT_ACCOUNT_ID,
            amount: AMOUNT,
          }),
          signal: AbortSignal.timeout(15000),
        });

        const latency = performance.now() - requestStartedAt;
        latencies.push(latency);

        if (response.ok) {
          successful++;
        } else {
          const body = await response.text();
          errors.push({
            status: response.status,
            message: body.slice(0, 200),
          });
        }
      } catch (error) {
        latencies.push(performance.now() - requestStartedAt);
        errors.push({
          status: "NETWORK/TIMEOUT",
          message: error.message,
        });
      }

      completed++;

      if (completed % 25 === 0 || completed === REQUESTS) {
        console.log(`Completed: ${completed}/${REQUESTS}`);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(CONCURRENCY, REQUESTS) },
      () => worker()
    )
  );

  const durationSeconds = (performance.now() - startedAt) / 1000;
  const p90 = percentile(latencies, 0.9);
  const p50 = percentile(latencies, 0.5);
  const max = latencies.length ? Math.max(...latencies) : null;
  const passed =
    successful === REQUESTS &&
    p90 !== null &&
    p90 <= P90_TARGET_MS;

  console.log("\n--- Benchmark Results ---");
  console.log(`Completed: ${completed}`);
  console.log(`Successful responses: ${successful}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Duration: ${durationSeconds.toFixed(2)} seconds`);
  console.log(`Throughput: ${(completed / durationSeconds).toFixed(2)} requests/sec`);
  console.log(`P50 latency: ${p50 === null ? "N/A" : `${p50.toFixed(2)} ms`}`);
  console.log(`P90 latency: ${p90 === null ? "N/A" : `${p90.toFixed(2)} ms`}`);
  console.log(`Maximum latency: ${max === null ? "N/A" : `${max.toFixed(2)} ms`}`);
  console.log(`P90 target (<= ${P90_TARGET_MS} ms): ${p90 !== null && p90 <= P90_TARGET_MS ? "PASS" : "FAIL"}`);

  if (errors.length) {
    console.log("\nFirst 10 errors:");
    console.log(JSON.stringify(errors.slice(0, 10), null, 2));
  }

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exitCode = 1;
});
