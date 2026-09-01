import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('migration manifest points to repository tip and separates production-applied, pending core and deferred referral rollout', async () => {
  const [current, readme] = await Promise.all([
    readFile('db/migrations/CURRENT', 'utf8'),
    readFile('db/migrations/README.md', 'utf8'),
  ]);

  expect(current.trim()).toBe('0036_durable_artwork_objects.sql');

  for (const migration of [
    '0030_background_job_pipeline.sql',
    '0031_quiz_encryption_v2.sql',
    '0032_private_payload_key_v2.sql',
    '0033_contact_otp_rate_limits.sql',
    '0034_referral_launch_outreach.sql',
    '0035_referral_private_payload_key_v2.sql',
    '0036_durable_artwork_objects.sql',
  ]) {
    expect(readme).toContain(`\`${migration}\``);
  }

  expect(readme).toMatch(/production.*0030.*0031.*0032.*0033/is);
  expect(readme).toMatch(/pending.*0036/is);
  expect(readme).toMatch(/deferred.*0029.*0034.*0035/is);
  expect(readme).not.toMatch(/apply in lexicographic filename order/i);
});
