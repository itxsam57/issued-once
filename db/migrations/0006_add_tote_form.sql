ALTER TABLE experience_physical_selection
  DROP CONSTRAINT IF EXISTS experience_physical_selection_object_type_check;

ALTER TABLE experience_physical_selection
  ADD CONSTRAINT experience_physical_selection_object_type_check
  CHECK (object_type IN ('tee', 'hoodie', 'hat', 'tote'));
