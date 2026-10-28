require("dotenv").config();

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const encodedKey = process.env.DATA_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error("DATA_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(encodedKey, "base64");

  if (
    key.length !== 32 ||
    key.toString("base64").replace(/=+$/, "") !==
      encodedKey.replace(/=+$/, "")
  ) {
    throw new Error("DATA_ENCRYPTION_KEY must be a valid Base64-encoded 32-byte key");
  }

  return key;
}

function encryptData(plaintext) {
  if (typeof plaintext !== "string") {
    throw new TypeError("Data to encrypt must be a string");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "enc-v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

function decryptData(encryptedValue) {
  if (typeof encryptedValue !== "string") {
    throw new TypeError("Encrypted data must be a string");
  }

  const parts = encryptedValue.split(":");

  if (parts.length !== 4 || parts[0] !== "enc-v1") {
    throw new Error("Unsupported or invalid encrypted data format");
  }

  const iv = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data format");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

function decryptIfEncrypted(value) {
  if (typeof value !== "string") {
    throw new TypeError("Data must be a string");
  }

  if (!value.startsWith("enc-v1:")) {
    return value; // Support existing plaintext records
  }

  return decryptData(value);
}

module.exports = { encryptData, decryptData, decryptIfEncrypted };
