import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

test('live boundary accepts the configured Safepay malformed-envelope rejection', () => {
  const source = readFileSync(join(process.cwd(), 'tests/e2e/live-non-otp-boundaries.mjs'), 'utf8');
  expect(source).toContain("'/api/webhooks/safepay',\n      [400, 401],");
});
