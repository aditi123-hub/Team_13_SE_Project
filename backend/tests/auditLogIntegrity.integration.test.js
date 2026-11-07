
const test = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("pg");
require("dotenv").config();

test("audit log database triggers prevent unauthorized changes", async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO "AuditLog"
        ("userId", event, outcome, "previousHash", "recordHash")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [null, "INTEGRITY_TEST", "SUCCESS", "TEST_PREVIOUS", "PENDING"]
    );

    const testId = inserted.rows[0].id;

    // An ordinary update must be rejected.
    await client.query("SAVEPOINT before_update");

    let updateError;
    try {
      await client.query(
        `UPDATE "AuditLog" SET outcome = $1 WHERE id = $2`,
        ["MODIFIED", testId]
      );
    } catch (error) {
      updateError = error;
    }

    assert.ok(updateError, "Unauthorized update should be rejected");
    assert.match(updateError.message, /cannot be modified/i);

    await client.query("ROLLBACK TO SAVEPOINT before_update");

    // Deletion must be rejected.
    await client.query("SAVEPOINT before_delete");

    let deleteError;
    try {
      await client.query(
        `DELETE FROM "AuditLog" WHERE id = $1`,
        [testId]
      );
    } catch (error) {
      deleteError = error;
    }

    assert.ok(deleteError, "Audit log deletion should be rejected");
    assert.match(deleteError.message, /cannot be deleted/i);

    await client.query("ROLLBACK TO SAVEPOINT before_delete");

    // The logger's one-time PENDING -> final hash update should work.
    await client.query("SAVEPOINT before_hash_update");
    const hashUpdate = await client.query(
      `UPDATE "AuditLog"
       SET "recordHash" = $1
       WHERE id = $2 AND "recordHash" = $3`,
      ["FINAL_TEST_HASH", testId, "PENDING"]
    );

    assert.equal(
      hashUpdate.rowCount,
      1,
      "PENDING -> final hash update should be permitted"
    );

    const updated = await client.query(
      `SELECT "recordHash" FROM "AuditLog" WHERE id = $1`,
      [testId]
    );

    assert.equal(updated.rows[0].recordHash, "FINAL_TEST_HASH");
    // Roll back the temporary test record in all cases.
    await client.query("ROLLBACK");
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // The transaction may already have been rolled back.
    }
    await client.end();
  }
});
