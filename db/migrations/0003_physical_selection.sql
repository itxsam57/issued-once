CREATE TABLE IF NOT EXISTS experience_physical_selection (
  experience_id UUID PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('tee', 'hoodie', 'hat')),
  product_slug TEXT NOT NULL,
  size_code TEXT,
  color_code TEXT,
  color_label TEXT,
  color_swatch TEXT,
  variant_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS experience_physical_selection_product_idx
  ON experience_physical_selection (product_slug);
