BEGIN;

CREATE OR REPLACE FUNCTION project_issue_event_metrics()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_reserved timestamptz;
  v_prior timestamptz;
BEGIN
  IF NEW.event_type='IN_PRODUCTION' THEN
    SELECT reserved_at INTO v_reserved FROM issues WHERE id=NEW.issue_id;
    IF v_reserved IS NOT NULL THEN
      PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'timing_paid_to_production','all','*',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_reserved)));
    END IF;
  ELSIF NEW.event_type='DELIVERED' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'delivered','all','*',1,0,0);
    SELECT created_at INTO v_prior FROM issue_events
    WHERE issue_id=NEW.issue_id AND event_type='IN_PRODUCTION' AND created_at<=NEW.created_at
    ORDER BY created_at DESC LIMIT 1;
    IF v_prior IS NOT NULL THEN
      PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'timing_production_to_delivered','all','*',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_prior)));
    END IF;
  ELSIF NEW.event_type='DESIGN_APPROVED' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'design_approved','all','*',1,0,0);
  ELSIF NEW.event_type='DESIGN_REWORK_QUEUED' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE 'UTC')::date,'design_rework',COALESCE('mode:'||(NEW.safe_detail->>'mode'),'mode:unknown'),'*',1,0,0);
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
