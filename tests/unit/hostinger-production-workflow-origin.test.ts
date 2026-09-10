import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const workflows = [
  'hostinger-live-boundary-audit.yml',
  'hostinger-strict-header-audit.yml',
  'hostinger-temp-proof.yml',
  'hostinger-live-support-proof.yml',
];

test.each(workflows)('%s targets the canonical production origin', (name) => {
  const workflow = readFileSync(join(process.cwd(), '.github/workflows', name), 'utf8');
  expect(workflow).toContain('LIVE_PRODUCTION_URL: https://issuedonce.shop');
  expect(workflow).not.toContain('lightgray-coyote-141764.hostingersite.com');
});
