import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const migrationPath = 'db/migrations/0035_referral_private_payload_key_v2.sql';

describe('0035 referral private payload V2 migration', () => {
  test('broadens only referral creator-email and payout-detail key constraints to V1 and V2', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/\bBEGIN\b/i);
    expect(sql).toMatch(/\bCOMMIT\b/i);

    const expectations = [
      ['referral_creators', 'referral_creators_email_key_version_check', 'email_key_version'],
      ['referral_payout_requests', 'referral_payout_requests_details_key_version_check', 'details_key_version'],
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
      ['referral_creators', 'referral_payout_requests'].sort(),
    );

    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE)\b/i);
    expect(sql).not.toMatch(/checkout_quotes|payment_attempts|referral_conversions|manufacturing_jobs|manufacturing_provider_events/i);
  });
});
