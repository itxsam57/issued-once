import { describe, expect, test } from 'vitest';
import { PostgresContactRepository } from '@/server/contact/PostgresContactRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

class CapturingSql implements SqlExecutor {
  calls: Array<{ text: string; params: readonly unknown[] }> = [];

  constructor(private readonly result: Array<Record<string, unknown>>) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<Row[]> {
    this.calls.push({ text, params });
    return this.result as Row[];
  }
}

const reservation = {
  subjectKind: 'email' as const,
  subjectHash: 'a'.repeat(64),
  now: new Date('2026-08-25T15:00:00.000Z'),
  shortWindowCutoff: new Date('2026-08-25T14:50:00.000Z'),
  longWindowCutoff: new Date('2026-08-24T15:00:00.000Z'),
  shortLimit: 3,
  longLimit: 10,
};

describe('PostgresContactRepository OTP rate-limit reservation', () => {
  test('uses a single atomic upsert guarded by both windows', async () => {
    const sql = new CapturingSql([{ ok: true }]);
    const repository = new PostgresContactRepository(sql);

    await expect(repository.reserveOtpRateLimit(reservation)).resolves.toBe(true);
    expect(sql.calls).toHaveLength(1);

    const [{ text, params }] = sql.calls;
    expect(text).toMatch(/INSERT\s+INTO\s+otp_rate_limits/i);
    expect(text).toMatch(/ON\s+CONFLICT\s*\(\s*subject_kind\s*,\s*subject_hash\s*\)\s+DO\s+UPDATE/i);
    expect(text).toMatch(/short_window_started_at/i);
    expect(text).toMatch(/long_window_started_at/i);
    expect(text).toMatch(/short_count\s*</i);
    expect(text).toMatch(/long_count\s*</i);
    expect(text).toMatch(/RETURNING\s+TRUE\s+AS\s+ok/i);
    expect(params).toEqual([
      reservation.subjectKind,
      reservation.subjectHash,
      reservation.now,
      reservation.shortWindowCutoff,
      reservation.longWindowCutoff,
      reservation.shortLimit,
      reservation.longLimit,
    ]);
  });

  test('returns false when the guarded upsert refuses an exhausted budget', async () => {
    const sql = new CapturingSql([]);
    const repository = new PostgresContactRepository(sql);

    await expect(repository.reserveOtpRateLimit(reservation)).resolves.toBe(false);
  });

  test('prunes only stale limiter rows in an oldest-first bounded batch', async () => {
    const sql = new CapturingSql([{ deleted_count: 17 }]);
    const repository = new PostgresContactRepository(sql);
    const olderThan = new Date('2026-08-23T15:00:00.000Z');

    await expect(repository.pruneOtpRateLimits({ olderThan, limit: 5000 })).resolves.toBe(17);
    expect(sql.calls).toHaveLength(1);

    const [{ text, params }] = sql.calls;
    expect(text).toMatch(/DELETE\s+FROM\s+otp_rate_limits/i);
    expect(text).toMatch(/updated_at\s*<\s*\$1/i);
    expect(text).toMatch(/ORDER\s+BY\s+updated_at\s+ASC/i);
    expect(text).toMatch(/LIMIT\s+\$2/i);
    expect(text).toMatch(/COUNT\s*\(\s*\*\s*\)/i);
    expect(params).toEqual([olderThan, 5000]);
  });
});
