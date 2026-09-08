import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const migrationPath = 'db/migrations/0028_design_controls.sql';

test('0028 adds design policy config, per-Issue overrides, and manual artwork provenance', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  expect(sql).toMatch(/config_type[^\n]*DESIGN_POLICY|DESIGN_POLICY[\s\S]*config_type/i);
  expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS issue_design_policy_overrides/i);
  expect(sql).toMatch(/issue_id uuid PRIMARY KEY REFERENCES issues\(id\) ON DELETE CASCADE/i);
  expect(sql).toMatch(/payload jsonb NOT NULL/i);
  expect(sql).toMatch(/OWNER_UPLOAD/i);
  expect(sql).toMatch(/ops_design_candidates_source_check/i);
});

test('repository migration head is not behind 0028 design controls', () => {
  const current = readFileSync('db/migrations/CURRENT', 'utf8').trim();
  const migrationNumber = Number.parseInt(current.slice(0, 4), 10);

  expect(migrationNumber).toBeGreaterThanOrEqual(28);
  expect(current).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
});
