BEGIN;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS payment_exception_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_exception_at TIMESTAMPTZ;

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS issues_payment_exception_code_check;

ALTER TABLE issues
  ADD CONSTRAINT issues_payment_exception_code_check
  CHECK (payment_exception_code IS NULL OR payment_exception_code IN ('PAYMENT_REFUNDED','PAYMENT_EXCEPTION'));

CREATE OR REPLACE FUNCTION project_payment_exception_to_issue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'REFUNDED' AND OLD.status IS DISTINCT FROM 'REFUNDED' THEN
    UPDATE issues
    SET payment_exception_code = 'PAYMENT_REFUNDED',
        payment_exception_at = NEW.updated_at,
        updated_at = GREATEST(updated_at, NEW.updated_at)
    WHERE payment_attempt_id = NEW.id;
  ELSIF NEW.status = 'EXCEPTION' AND OLD.status IS DISTINCT FROM 'EXCEPTION' THEN
    UPDATE issues
    SET payment_exception_code = COALESCE(payment_exception_code, 'PAYMENT_EXCEPTION'),
        payment_exception_at = COALESCE(payment_exception_at, NEW.updated_at),
        updated_at = GREATEST(updated_at, NEW.updated_at)
    WHERE payment_attempt_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_attempt_issue_exception_projection ON payment_attempts;
CREATE TRIGGER payment_attempt_issue_exception_projection
AFTER UPDATE OF status ON payment_attempts
FOR EACH ROW
WHEN (NEW.status IN ('REFUNDED','EXCEPTION'))
EXECUTE FUNCTION project_payment_exception_to_issue();

CREATE OR REPLACE FUNCTION enforce_issue_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Once a factory charge has happened, financial exceptions are an overlay.
  -- Preserve the physical state so signed shipment/delivery truth can continue.
  IF OLD.status IN ('IN_PRODUCTION','IN_TRANSIT')
     AND NEW.status = 'EXCEPTION'
     AND OLD.payment_exception_code IS NOT NULL THEN
    NEW.status := OLD.status;
    RETURN NEW;
  END IF;

  IF OLD.status = 'RECEIVED' AND NEW.status IN ('BEING_INTERPRETED','EXCEPTION','CANCELED') THEN RETURN NEW; END IF;
  IF OLD.status = 'BEING_INTERPRETED' AND NEW.status IN ('DESIGN_REVIEW','EXCEPTION','CANCELED') THEN RETURN NEW; END IF;
  IF OLD.status = 'DESIGN_REVIEW' AND NEW.status IN ('DESIGN_APPROVED','EXCEPTION','CANCELED') THEN RETURN NEW; END IF;
  IF OLD.status = 'DESIGN_APPROVED' AND NEW.status IN ('MANUFACTURING_DRAFT','EXCEPTION','CANCELED') THEN RETURN NEW; END IF;
  IF OLD.status = 'MANUFACTURING_DRAFT' AND NEW.status IN ('IN_PRODUCTION','EXCEPTION','CANCELED') THEN RETURN NEW; END IF;
  IF OLD.status = 'IN_PRODUCTION' AND NEW.status IN ('IN_TRANSIT','CANCELED') THEN RETURN NEW; END IF;
  IF OLD.status = 'IN_TRANSIT' AND NEW.status IN ('DELIVERED','CANCELED') THEN RETURN NEW; END IF;
  IF OLD.status = 'EXCEPTION' AND NEW.status = 'CANCELED' THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'invalid Issue status transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = '55000';
END;
$$;

COMMIT;
