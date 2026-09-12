import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/server/experience/runtimeResume.ts'),
  'utf8',
);

describe('experience resume runtime schema authority', () => {
  it('uses referral-aware quotes only after referral activation and keeps the core fallback', () => {
    expect(source).toContain('PostgresCheckoutQuoteRepository');
    expect(source).toContain('PostgresReferralQuoteRepository');
    expect(source).toContain('referralsAreEnabled()');
    expect(source).toContain('? new PostgresReferralQuoteRepository(sql)');
    expect(source).toContain(': new PostgresCheckoutQuoteRepository(sql)');
  });
});
