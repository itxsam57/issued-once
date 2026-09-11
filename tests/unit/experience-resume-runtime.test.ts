import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/server/experience/runtimeResume.ts'),
  'utf8',
);

describe('experience resume runtime schema authority', () => {
  it('uses the core checkout quote repository before referral activation', () => {
    expect(source).toContain('PostgresCheckoutQuoteRepository');
    expect(source).toContain('quotes: new PostgresCheckoutQuoteRepository(sql)');
    expect(source).not.toContain('PostgresReferralQuoteRepository');
  });
});
