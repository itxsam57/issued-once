import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const migrationPath = 'db/migrations/0033_otp_rate_limits.sql';

describe('0033 OTP rate-limit state migration', () => {
  test('adds only hashed atomic rate-limit state without raw identity fields or unrelated mutations', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/\bBEGIN\b/i);
    expect(sql).toMatch(/\bCOMMIT\b/i);
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+otp_rate_limits/i);
    expect(sql).toMatch(/subject_kind\s+text\s+NOT\s+NULL/i);
    expect(sql).toMatch(/subject_kind\s+IN\s*\(\s*'email'\s*,\s*'experience'\s*,\s*'ip'\s*\)/i);
    expect(sql).toMatch(/subject_hash\s+text\s+NOT\s+NULL/i);
    expect(sql).toMatch(/subject_hash\s*~\s*'\^\[0-9a-f\]\{64\}\$'/i);
    expect(sql).toMatch(/PRIMARY\s+KEY\s*\(\s*subject_kind\s*,\s*subject_hash\s*\)/i);
    expect(sql).toMatch(/short_window_started_at\s+timestamptz\s+NOT\s+NULL/i);
    expect(sql).toMatch(/short_count\s+integer\s+NOT\s+NULL/i);
    expect(sql).toMatch(/long_window_started_at\s+timestamptz\s+NOT\s+NULL/i);
    expect(sql).toMatch(/long_count\s+integer\s+NOT\s+NULL/i);
    expect(sql).toMatch(/otp_rate_limits_updated_at_idx/i);

    expect(sql).not.toMatch(/email_address|raw_email|raw_ip|ip_address|otp_code|shipping|address|phone/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE/i);
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE)\b/i);
    expect(sql).not.toMatch(/referral_creators|referral_conversions|manufacturing_jobs|manufacturing_provider_events|payment_attempts|checkout_quotes/i);
  });
});
