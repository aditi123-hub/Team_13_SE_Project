-- Prevent audit records from being deleted.
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_prevent_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_delete();

-- Prevent changes to existing audit records.
-- Allow only the logger's one-time PENDING -> final hash update.
CREATE OR REPLACE FUNCTION protect_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."recordHash" = 'PENDING'
     AND NEW."recordHash" IS NOT NULL
     AND NEW."recordHash" <> 'PENDING'
     AND NEW."id" = OLD."id"
     AND NEW."userId" IS NOT DISTINCT FROM OLD."userId"
     AND NEW."event" = OLD."event"
     AND NEW."outcome" = OLD."outcome"
     AND NEW."timestamp" = OLD."timestamp"
     AND NEW."previousHash" IS NOT DISTINCT FROM OLD."previousHash"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Audit logs cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_protect_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION protect_audit_log_update();
