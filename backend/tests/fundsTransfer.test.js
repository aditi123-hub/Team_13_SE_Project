const assert = require("assert");

/**
 * Funds Transfer Business Logic Unit Test Suite
 * Author: Amilineni Sai Dhyan Anubhav (saidhyan45-coder)
 * Validates BMS-F-011 (Intra-Bank Transfer), BMS-F-012 (2FA Trigger), BMS-F-013 (Daily Limits)
 */

console.log("--> Running Funds Transfer Engine Unit Tests...");

function validateTransferRequest({ fromAccountId, toAccountId, amount, senderBalance, todayCompletedVolume = 0 }) {
  if (!fromAccountId || !toAccountId) {
    return { ok: false, status: 400, message: "Source and destination accounts are required" };
  }
  if (fromAccountId === toAccountId) {
    return { ok: false, status: 400, message: "Cannot transfer funds to the same account" };
  }
  if (!amount || amount <= 0) {
    return { ok: false, status: 400, message: "Transfer amount must be strictly greater than zero" };
  }
  if (senderBalance < amount) {
    return { ok: false, status: 400, message: "Insufficient account balance for transfer" };
  }
  const DAILY_LIMIT = 50000;
  if (todayCompletedVolume + amount > DAILY_LIMIT) {
    return {
      ok: false,
      status: 400,
      message: `Daily transfer limit of ₹${DAILY_LIMIT.toLocaleString()} exceeded. Current total: ₹${(todayCompletedVolume + amount).toLocaleString()}`,
    };
  }

  const HIGH_VALUE_THRESHOLD = 10000;
  const requiresOtp = amount >= HIGH_VALUE_THRESHOLD;

  return {
    ok: true,
    status: 200,
    requiresOtp,
    fee: 0,
    message: requiresOtp ? "2FA OTP verification required for high-value transfer" : "Transfer authorized for settlement",
  };
}

// 1. Same account rejection
const res1 = validateTransferRequest({ fromAccountId: "ACC-1", toAccountId: "ACC-1", amount: 1000, senderBalance: 5000 });
assert.strictEqual(res1.ok, false);
assert.strictEqual(res1.status, 400);

// 2. Insufficient balance
const res2 = validateTransferRequest({ fromAccountId: "ACC-1", toAccountId: "ACC-2", amount: 6000, senderBalance: 5000 });
assert.strictEqual(res2.ok, false);

// 3. Normal transfer under threshold (< 10k)
const res3 = validateTransferRequest({ fromAccountId: "ACC-1", toAccountId: "ACC-2", amount: 5000, senderBalance: 20000 });
assert.strictEqual(res3.ok, true);
assert.strictEqual(res3.requiresOtp, false);

// 4. High-value transfer trigger (>= 10k)
const res4 = validateTransferRequest({ fromAccountId: "ACC-1", toAccountId: "ACC-2", amount: 15000, senderBalance: 20000 });
assert.strictEqual(res4.ok, true);
assert.strictEqual(res4.requiresOtp, true);

// 5. Daily limit breach
const res5 = validateTransferRequest({
  fromAccountId: "ACC-1",
  toAccountId: "ACC-2",
  amount: 25000,
  senderBalance: 50000,
  todayCompletedVolume: 30000,
});
assert.strictEqual(res5.ok, false);
assert.match(res5.message, /Daily transfer limit/);

console.log(" Funds Transfer Engine unit tests passed 100%!");
