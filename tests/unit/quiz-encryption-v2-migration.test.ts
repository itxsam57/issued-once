import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const migrationPath = 'db/migrations/0031_quiz_encryption_key_v2.sql';

describe('0031 quiz encryption V2 schema migration', () => {
  test('broadens only the experience answer key-version constraint to V1 and V2', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/\bBEGIN\b/i);
    expect(sql).toMatch(/\bCOMMIT\b/i);
    expect(sql).toMatch(/ALTER\s+TABLE\s+(?:public\.)?experience_answers/i);
    expect(sql).toMatch(/DROP\s+CONSTRAINT\s+experience_answers_key_version_check/i);
    expect(sql).toMatch(
      /ADD\s+CONSTRAINT\s+experience_answers_key_version_check[\s\S]*CHECK\s*\(\s*key_version\s+IN\s*\(\s*'v1'\s*,\s*'v2'\s*\)\s*\)/i,
    );

    const alteredTables = [
      ...sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi),
    ].map((match) => match[1]?.toLowerCase());
    expect([...new Set(alteredTables)]).toEqual(['experience_answers']);

    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE)\b/i);
    expect(sql).not.toMatch(/referral_creators|referral_conversions|manufacturing_jobs|manufacturing_provider_events|checkout_quotes|payment_attempts/i);
  });
});
