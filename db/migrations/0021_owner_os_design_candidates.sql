BEGIN;

CREATE TABLE IF NOT EXISTS ops_design_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  design_job_id uuid NOT NULL REFERENCES design_jobs(id) ON DELETE CASCADE,
  generation_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('AUTOMATIC','OWNER_REGENERATE','OWNER_REINTERPRET')),
  brief_payload_version smallint,
  brief_key_version text,
  brief_iv text,
  brief_auth_tag text,
  brief_ciphertext text,
  artwork_url text NOT NULL,
  artwork_mime_type text NOT NULL,
  artwork_bytes bigint NOT NULL CHECK (artwork_bytes > 0),
  artwork_width integer NOT NULL CHECK (artwork_width > 0),
  artwork_height integer NOT NULL CHECK (artwork_height > 0),
  provider text NOT NULL,
  model text NOT NULL,
  safe_summary text,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (issue_id, generation_key),
  CHECK (
    (brief_payload_version IS NULL AND brief_key_version IS NULL AND brief_iv IS NULL AND brief_auth_tag IS NULL AND brief_ciphertext IS NULL)
    OR
    (brief_payload_version = 1 AND brief_key_version = 'v1' AND brief_iv IS NOT NULL AND brief_auth_tag IS NOT NULL AND brief_ciphertext IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ops_design_candidates_selected_issue_idx
  ON ops_design_candidates (issue_id)
  WHERE selected;

CREATE INDEX IF NOT EXISTS ops_design_candidates_issue_created_idx
  ON ops_design_candidates (issue_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION enforce_issue_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF OLD.status IN ('DESIGN_REVIEW','DESIGN_APPROVED')
     AND NEW.status IN ('BEING_INTERPRETED','DESIGN_REVIEW')
     AND NOT EXISTS (
       SELECT 1 FROM manufacturing_jobs manufacturing
       WHERE manufacturing.issue_id=OLD.id
         AND manufacturing.state IN ('DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED')
     ) THEN
    RETURN NEW;
  END IF;

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
