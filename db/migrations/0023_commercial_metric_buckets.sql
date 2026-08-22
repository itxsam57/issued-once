BEGIN;

CREATE TABLE IF NOT EXISTS commercial_metric_buckets (
  bucket_day date NOT NULL,
  metric_key text NOT NULL,
  dimension_key text NOT NULL DEFAULT 'all',
  currency_scope text NOT NULL DEFAULT '*',
  event_count bigint NOT NULL DEFAULT 0,
  value_minor bigint NOT NULL DEFAULT 0,
  value_seconds numeric(24,3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_day, metric_key, dimension_key, currency_scope),
  CHECK (currency_scope='*' OR currency_scope ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS commercial_metric_buckets_metric_day_idx
  ON commercial_metric_buckets (metric_key, bucket_day DESC, dimension_key, currency_scope);

CREATE OR REPLACE FUNCTION commercial_metric_add(
  p_day date,
  p_metric text,
  p_dimension text,
  p_currency text,
  p_count bigint DEFAULT 0,
  p_minor bigint DEFAULT 0,
  p_seconds numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO commercial_metric_buckets (
    bucket_day, metric_key, dimension_key, currency_scope,
    event_count, value_minor, value_seconds, updated_at
  ) VALUES (
    p_day, p_metric, COALESCE(NULLIF(p_dimension,''),'all'), COALESCE(NULLIF(p_currency,''),'*'),
    p_count, p_minor, p_seconds, NOW()
  )
  ON CONFLICT (bucket_day, metric_key, dimension_key, currency_scope)
  DO UPDATE SET
    event_count = commercial_metric_buckets.event_count + EXCLUDED.event_count,
    value_minor = commercial_metric_buckets.value_minor + EXCLUDED.value_minor,
    value_seconds = commercial_metric_buckets.value_seconds + EXCLUDED.value_seconds,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION project_experience_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'funnel_started','all','*',1,0,0);
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage
    AND NEW.stage NOT IN ('VISITOR','EXPERIENCE_STARTED','QUESTION_1','QUESTION_2','QUESTION_3','QUESTION_4','QUESTION_5','QUESTION_6','QUESTION_7')
    AND OLD.stage IN ('VISITOR','EXPERIENCE_STARTED','QUESTION_1','QUESTION_2','QUESTION_3','QUESTION_4','QUESTION_5','QUESTION_6','QUESTION_7') THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE 'UTC')::date,'funnel_answered','all','*',1,0,0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experiences_metric_projection ON experiences;
CREATE TRIGGER experiences_metric_projection
AFTER INSERT OR UPDATE OF stage ON experiences
FOR EACH ROW EXECUTE FUNCTION project_experience_metrics();

CREATE OR REPLACE FUNCTION project_physical_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.color_code IS NOT NULL AND (TG_OP='INSERT' OR OLD.color_code IS NULL) THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE 'UTC')::date,'funnel_physical','all','*',1,0,0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS physical_metric_projection ON experience_physical_selection;
CREATE TRIGGER physical_metric_projection
AFTER INSERT OR UPDATE OF color_code ON experience_physical_selection
FOR EACH ROW EXECUTE FUNCTION project_physical_metrics();

CREATE OR REPLACE FUNCTION project_verified_contact_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM commercial_metric_add((NEW.verified_at AT TIME ZONE 'UTC')::date,'funnel_verified','all','*',1,0,0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS verified_contact_metric_projection ON verified_contacts;
CREATE TRIGGER verified_contact_metric_projection AFTER INSERT ON verified_contacts
FOR EACH ROW EXECUTE FUNCTION project_verified_contact_metrics();

CREATE OR REPLACE FUNCTION project_shipping_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'funnel_shipping','all','*',1,0,0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shipping_metric_projection ON shipping_snapshots;
CREATE TRIGGER shipping_metric_projection AFTER INSERT ON shipping_snapshots
FOR EACH ROW EXECUTE FUNCTION project_shipping_metrics();

CREATE OR REPLACE FUNCTION project_payment_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_old_status text;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'funnel_checkout','all','*',1,0,0);
    v_old_status := NULL;
  ELSE
    v_old_status := OLD.status;
  END IF;

  IF NEW.status IN ('PAID','REFUNDED') AND COALESCE(v_old_status,'') NOT IN ('PAID','REFUNDED') THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE 'UTC')::date,'funnel_paid','all','*',1,0,0);
  END IF;
  IF NEW.status='FAILED' AND COALESCE(v_old_status,'') <> 'FAILED' THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE 'UTC')::date,'payment_failed','all','*',1,0,0);
  END IF;
  IF NEW.status='EXCEPTION' AND COALESCE(v_old_status,'') <> 'EXCEPTION' THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE 'UTC')::date,'payment_exception','all','*',1,0,0);
  END IF;
  IF NEW.status='REFUNDED' AND COALESCE(v_old_status,'') <> 'REFUNDED' THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE 'UTC')::date,'refund','all',NEW.currency,1,NEW.amount_minor,0);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS payment_metric_projection ON payment_attempts;
CREATE TRIGGER payment_metric_projection AFTER INSERT OR UPDATE OF status ON payment_attempts
FOR EACH ROW EXECUTE FUNCTION project_payment_metrics();

CREATE OR REPLACE FUNCTION project_issue_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_country text;
  v_started timestamptz;
BEGIN
  IF NEW.payment_attempt_id IS NULL OR NEW.currency IS NULL OR NEW.amount_minor IS NULL THEN RETURN NEW; END IF;
  PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE 'UTC')::date,'paid_order','all',NEW.currency,1,0,0);
  PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE 'UTC')::date,'gross_paid','all',NEW.currency,1,NEW.amount_minor,0);
  IF NEW.object_type IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE 'UTC')::date,'paid_order','object:'||NEW.object_type,NEW.currency,1,0,0); END IF;
  IF NEW.size_code IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE 'UTC')::date,'paid_order','size:'||NEW.size_code,NEW.currency,1,0,0); END IF;
  IF NEW.color_code IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE 'UTC')::date,'paid_order','color:'||NEW.color_code,NEW.currency,1,0,0); END IF;
  SELECT country_code INTO v_country FROM shipping_snapshots WHERE id=NEW.shipping_snapshot_id;
  IF v_country IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE 'UTC')::date,'paid_order','country:'||v_country,NEW.currency,1,0,0); END IF;
  SELECT created_at INTO v_started FROM experiences WHERE id=NEW.experience_id;
  IF v_started IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE 'UTC')::date,'timing_start_to_paid','all','*',1,0,EXTRACT(EPOCH FROM (NEW.reserved_at-v_started))); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS issue_metric_projection ON issues;
CREATE TRIGGER issue_metric_projection AFTER INSERT ON issues
FOR EACH ROW EXECUTE FUNCTION project_issue_metrics();

CREATE OR REPLACE FUNCTION project_issue_event_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_reserved timestamptz;
  v_prior timestamptz;
BEGIN
  IF NEW.event_type='IN_PRODUCTION' THEN
    SELECT reserved_at INTO v_reserved FROM issues WHERE id=NEW.issue_id;
    IF v_reserved IS NOT NULL THEN PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'timing_paid_to_production','all','*',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_reserved))); END IF;
  ELSIF NEW.event_type='DELIVERED' THEN
    SELECT created_at INTO v_prior FROM issue_events
    WHERE issue_id=NEW.issue_id AND event_type='IN_PRODUCTION' AND created_at<=NEW.created_at
    ORDER BY created_at DESC LIMIT 1;
    IF v_prior IS NOT NULL THEN PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'timing_production_to_delivered','all','*',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_prior))); END IF;
  ELSIF NEW.event_type='DESIGN_APPROVED' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'design_approved','all','*',1,0,0);
  ELSIF NEW.event_type='DESIGN_REWORK_QUEUED' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'design_rework',COALESCE('mode:'||(NEW.safe_detail->>'mode'),'mode:unknown'),'*',1,0,0);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS issue_event_metric_projection ON issue_events;
CREATE TRIGGER issue_event_metric_projection AFTER INSERT ON issue_events
FOR EACH ROW EXECUTE FUNCTION project_issue_event_metrics();

CREATE OR REPLACE FUNCTION project_support_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'support_request','all','*',1,0,0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS support_metric_projection ON support_requests;
CREATE TRIGGER support_metric_projection AFTER INSERT ON support_requests
FOR EACH ROW EXECUTE FUNCTION project_support_metrics();

COMMIT;
