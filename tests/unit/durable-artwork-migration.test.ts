import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('0036 creates a private durable artwork byte store with integrity and Issue ownership constraints', async () => {
  const sql = await readFile('db/migrations/0036_durable_artwork_objects.sql', 'utf8');

  expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS artwork_objects/i);
  expect(sql).toMatch(/issue_id uuid NOT NULL REFERENCES issues\(id\) ON DELETE CASCADE/i);
  expect(sql).toMatch(/bytes bytea NOT NULL/i);
  expect(sql).toMatch(/octet_length\(bytes\) = byte_count/i);
  expect(sql).toMatch(/content_sha256.*\^\[0-9a-f\]\{64\}\$/i);
  expect(sql).toMatch(/locator LIKE 'artwork:\/\/%'/i);
});
