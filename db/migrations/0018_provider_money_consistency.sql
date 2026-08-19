BEGIN;

CREATE OR REPLACE FUNCTION project_payment_exception_to_issue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  exception_code TEXT;
BEGIN
  IF NEW.status = 'REFUNDED' AND OLD.status IS DISTINCT FROM 'REFUNDED' THEN
    exception_code := 'PAYMENT_REFUNDED';
  ELSIF NEW.status = 'EXCEPTION' AND OLD.status IS DISTINCT FROM 'EXCEPTION' THEN
    exception_code := 'PAYMENT_EXCEPTION';
  ELSE
    RETURN NEW;
  END IF;

  UPDATE issues
  SET payment_exception_code = CASE
        WHEN exception_code = 'PAYMENT_REFUNDED' THEN 'PAYMENT_REFUNDED'
        ELSE COALESCE(payment_exception_code, exception_code)
      END,
      payment_exception_at = COALESCE(payment_exception_at, NEW.updated_at),
      status = CASE
        WHEN status IN ('RECEIVED','BEING_INTERPRETED','DESIGN_REVIEW','DESIGN_APPROVED','MANUFACTURING_DRAFT')
          THEN 'EXCEPTION'
        ELSE status
      END,
      updated_at = GREATEST(updated_at, NEW.updated_at)
  WHERE payment_attempt_id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION quarantine_provider_money_mismatch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE payment_attempts
  SET status = 'EXCEPTION',
      updated_at = GREATEST(updated_at, NEW.received_at)
  WHERE provider = NEW.provider
    AND provider_reference = NEW.provider_reference
    AND (amount_minor <> NEW.amount_minor OR currency <> NEW.currency)
    AND status <> 'EXCEPTION';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_provider_money_consistency ON payment_provider_events;
CREATE TRIGGER payment_provider_money_consistency
AFTER INSERT ON payment_provider_events
FOR EACH ROW
EXECUTE FUNCTION quarantine_provider_money_mismatch();

COMMIT;
