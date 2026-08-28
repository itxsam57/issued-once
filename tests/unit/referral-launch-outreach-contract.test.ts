import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('referral launch migration stores outreach separately with one successful campaign delivery per creator', async () => {
  const sql = await readFile('db/migrations/0034_referral_launch_outreach.sql', 'utf8');

  expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS referral_creator_outreach_deliveries/i);
  expect(sql).toMatch(/creator_id uuid NOT NULL REFERENCES referral_creators\(id\)/i);
  expect(sql).toMatch(/campaign text NOT NULL/i);
  expect(sql).toMatch(/state text NOT NULL CHECK \(state IN \('QUEUED','SENT','FAILED'\)\)/i);
  expect(sql).toMatch(/UNIQUE \(creator_id, campaign\)/i);
});

test('Postgres launch outreach repository selects only active unsent creators and makes successful delivery idempotent', async () => {
  const source = await readFile('src/server/referrals/PostgresReferralLaunchOutreachRepository.ts', 'utf8');

  expect(source).toMatch(/creator\.active\s*=\s*true/i);
  expect(source).toMatch(/referral_creator_outreach_deliveries/i);
  expect(source).toMatch(/state\s*=\s*'SENT'/i);
  expect(source).toMatch(/ON CONFLICT \(creator_id, campaign\)/i);
  expect(source).toMatch(/WHERE referral_creator_outreach_deliveries\.state <> 'SENT'/i);
});

test('launch outreach is an explicit owner-only action and deployment alone cannot send creator email', async () => {
  const route = await readFile('src/app/ops/api/referrals/launch-outreach/route.ts', 'utf8');
  const runtime = await readFile('src/server/ops/runtimeOwnerOs.ts', 'utf8');
  const panel = await readFile('src/components/ops/ReferralsPanel.tsx', 'utf8');

  expect(route).toMatch(/hasOpsSession/);
  expect(route).toMatch(/SEND_LAUNCH_REFERRALS/);
  expect(route).toMatch(/createReferralLaunchOutreachService/);
  expect(runtime).toMatch(/ResendCustomerEmailGateway/);
  expect(runtime).toMatch(/createReferralLaunchOutreachService/);
  expect(panel).toMatch(/SEND LAUNCH EMAILS/);
  expect(panel).toMatch(/SEND_LAUNCH_REFERRALS/);
});
