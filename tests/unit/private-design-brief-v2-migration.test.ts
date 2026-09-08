import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('design brief constraints accept current V2 encryption while retaining V1 readability', async () => {
  const sql = await readFile('db/migrations/0037_design_brief_key_v2.sql', 'utf8');

  expect(sql).toMatch(/ALTER TABLE design_jobs[\s\S]*brief_key_version IN \('v1', 'v2'\)/);
  expect(sql).toMatch(/ALTER TABLE ops_design_candidates[\s\S]*brief_key_version IN \('v1', 'v2'\)/);
  expect(sql).not.toMatch(/DELETE|TRUNCATE|DROP TABLE/i);
});
