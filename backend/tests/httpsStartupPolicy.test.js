const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldAbortOnHttpsFailure,
} = require("../src/services/httpsStartupPolicy");

test("production must abort when HTTPS startup fails", () => {
  assert.equal(shouldAbortOnHttpsFailure("production"), true);
});

test("development may use HTTP fallback when HTTPS startup fails", () => {
  assert.equal(shouldAbortOnHttpsFailure("development"), false);
});

test("test environments do not trigger production abort behavior", () => {
  assert.equal(shouldAbortOnHttpsFailure("test"), false);
});