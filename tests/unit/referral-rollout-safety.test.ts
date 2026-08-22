import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('0029 keeps the pre-referral gross quote writer valid during migration-first rollout', async () => {
  const sql = await readFile('db/migrations/0029_creator_referrals.sql', 'utf8');

  expect(sql).toMatch(/CREATE OR REPLACE FUNCTION\s+fill_checkout_quote_referral_amounts/i);
  expect(sql).toMatch(/NEW\.gross_amount_minor\s*:=\s*NEW\.amount_minor/i);
  expect(sql).toMatch(/NEW\.discount_amount_minor\s*:=\s*0/i);
  expect(sql).toMatch(/BEFORE INSERT ON checkout_quotes/i);
});

test('payment start has a latest-quote guard before creating a Safepay attempt', async () => {
  const source = await readFile('src/server/payments/PaymentService.ts', 'utf8');

  expect(source).toMatch(/findLatestByExperienceId/);
  expect(source).toMatch(/latest[^\n]*\.id[^\n]*quote\.id|quote\.id[^\n]*latest[^\n]*\.id/i);
  expect(source).toMatch(/latest quote|superseded quote/i);
});
