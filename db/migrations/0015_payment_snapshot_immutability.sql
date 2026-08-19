BEGIN;

CREATE OR REPLACE FUNCTION block_paid_contact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_attempts
    WHERE contact_id = OLD.id
      AND status IN ('CREATED','REDIRECTED','PAID','REFUNDED','EXCEPTION')
  ) THEN
    RAISE EXCEPTION 'verified contact is locked by payment truth'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verified_contacts_payment_lock ON verified_contacts;
CREATE TRIGGER verified_contacts_payment_lock
BEFORE UPDATE OR DELETE ON verified_contacts
FOR EACH ROW
EXECUTE FUNCTION block_paid_contact_mutation();

CREATE OR REPLACE FUNCTION block_paid_shipping_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_attempts
    WHERE shipping_snapshot_id = OLD.id
      AND status IN ('CREATED','REDIRECTED','PAID','REFUNDED','EXCEPTION')
  ) THEN
    RAISE EXCEPTION 'shipping snapshot is locked by payment truth'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipping_snapshots_payment_lock ON shipping_snapshots;
CREATE TRIGGER shipping_snapshots_payment_lock
BEFORE UPDATE OR DELETE ON shipping_snapshots
FOR EACH ROW
EXECUTE FUNCTION block_paid_shipping_mutation();

COMMIT;
