const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

const {
  encryptData,
  decryptData,
  decryptIfEncrypted,
} = require("../src/services/dataEncryption");

test("encrypts data and decrypts it to the original value", () => {
  const original = "sensitive-government-id-1234";
  const encrypted = encryptData(original);

  assert.notEqual(encrypted, original);
  assert.equal(decryptData(encrypted), original);
});

test("uses a different random nonce for each encryption", () => {
  const first = encryptData("same-value");
  const second = encryptData("same-value");

  assert.notEqual(first, second);
  assert.equal(decryptData(first), "same-value");
  assert.equal(decryptData(second), "same-value");
});

test("rejects tampered ciphertext", () => {
  const encrypted = encryptData("sensitive-value");
  const parts = encrypted.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");

  assert.throws(() => decryptData(parts.join(":")));
});

test("rejects unsupported encrypted data formats", () => {
  assert.throws(
    () => decryptData("plain-text"),
    /Unsupported or invalid encrypted data format/
  );
});

test("rejects non-string values", () => {
  assert.throws(() => encryptData(123), /must be a string/);
  assert.throws(() => decryptData(null), /must be a string/);
});
test("preserves legacy plaintext values", () => {
  const legacyValue = "legacy-government-id-1234";

  assert.equal(decryptIfEncrypted(legacyValue), legacyValue);
});

test("decrypts encrypted values through decryptIfEncrypted", () => {
  const original = "sensitive-government-id-5678";
  const encrypted = encryptData(original);

  assert.notEqual(encrypted, original);
  assert.equal(decryptIfEncrypted(encrypted), original);
});

test("rejects non-string values in decryptIfEncrypted", () => {
  assert.throws(
    () => decryptIfEncrypted(null),
    /must be a string/
  );
});
