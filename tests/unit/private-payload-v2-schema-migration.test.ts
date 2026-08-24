import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const migrationPath = 'db/migrations/0032_private_payload_key_v2.sql';

describe('0032 private payload V2 schema migration', () => {
  test('broadens only remaining private-payload key-version constraints to V1 and V2', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/\bBEGIN\b/i);
    expect(sql).toMatch(/\bCOMMIT\b/i);

    const expectations = [
      ['otp_challenges', 'otp_challenges_email_key_version_check', 'email_key_version'],
      ['verified_contacts', 'verified_contacts_key_version_check', 'key_version'],
      ['shipping_snapshots', 'shipping_snapshots_key_version_check', 'key_version'],
      ['support_requests', 'support_requests_key_version_check', 'key_version'],
    ] as const;

    for (const [table, constraint, column] of expectations) {
      expect(sql).toMatch(new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${table}`, 'i'));
      expect(sql).toMatch(new RegExp(`DROP\\s+CONSTRAINT\\s+${constraint}`, 'i'));
      expect(sql).toMatch(
        new RegExp(
          `ADD\\s+CONSTRAINT\\s+${constraint}[\\s\\S]*?CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(\\s*'v1'\\s*,\\s*'v2'\\s*\\)\\s*\\)`,
          'i',
        ),
      );
    }

    const alteredTables = [
      ...sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi),
    ].map((match) => match[1]?.toLowerCase());
    expect([...new Set(alteredTables)].sort()).toEqual(
      ['otp_challenges', 'shipping_snapshots', 'support_requests', 'verified_contacts'].sort(),
    );

    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE)\b/i);
    expect(sql).not.toMatch(/referral_creators|referral_conversions|manufacturing_jobs|manufacturing_provider_events|checkout_quotes|payment_attempts|experience_answers/i);
  });
});
