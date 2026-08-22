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

  WITH projected AS (
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
    WHERE payment_attempt_id = NEW.id
    RETURNING id,status
  )
  INSERT INTO issue_events(issue_id,event_type,source,safe_detail,created_at)
  SELECT id,exception_code,'SAFEPAY',NULL,NEW.updated_at
  FROM projected
  WHERE status='EXCEPTION'
    AND NOT EXISTS (
      SELECT 1 FROM issue_events existing
      WHERE existing.issue_id=projected.id
        AND existing.event_type=exception_code
        AND existing.source='SAFEPAY'
    );

  RETURN NEW;
END;
$$;

COMMIT;
