import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const source = readFileSync(join(process.cwd(), 'tests/e2e/live-non-otp-boundaries.mjs'), 'utf8');

test('live boundary accepts the configured Safepay malformed-envelope rejection', () => {
  expect(source).toContain("'/api/webhooks/safepay',\n      [400, 401],");
});

test('live boundary treats referral apply as an active customer gate after referral rollout', () => {
  expect(source).toContain("'/api/referrals/apply', [409]");
});
