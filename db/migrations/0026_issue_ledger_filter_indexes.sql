BEGIN;

CREATE INDEX IF NOT EXISTS issues_updated_id_idx
  ON issues (updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS issues_shipping_snapshot_idx
  ON issues (shipping_snapshot_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS shipping_snapshots_country_id_idx
  ON shipping_snapshots (country_code, id);

COMMIT;
