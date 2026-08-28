import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const proof = readFileSync(join(process.cwd(), 'tests/e2e/live-support-proof.mjs'), 'utf8');
const workflow = readFileSync(join(process.cwd(), '.github/workflows/hostinger-live-support-proof.yml'), 'utf8');
const routePath = join(process.cwd(), 'src/app/api/internal/support/canary/route.ts');

test('support canary is internal-only, fixed-target, and cannot become an arbitrary mail relay', () => {
  expect(existsSync(routePath)).toBe(true);
  const route = readFileSync(routePath, 'utf8');
  expect(route).toContain('authorizeInternalRequest');
  expect(route).toContain('SEND_SUPPORT_CANARY');
  expect(route).toContain("env('SUPPORT_INBOX_EMAIL')");
  expect(route).toContain('ResendSupportEmailGateway');
  expect(route).toContain('SUPPORT-CANARY');
  expect(route).not.toContain('body.email');
  expect(route).not.toContain('body.recipient');
  expect(route).not.toContain('body.message');
});

test('live support proof dispatches the authenticated canary only after exact-release health', () => {
  expect(proof).toContain('/api/health/release');
  expect(proof).toContain('process.env.EXPECTED_RELEASE_ID');
  expect(proof).toContain('process.env.INTERNAL_OPERATIONS_TOKEN');
  expect(proof).toContain('/api/internal/support/canary');
  expect(proof).toContain('SEND_SUPPORT_CANARY');
  expect(proof).toContain('authorization: `Bearer ${internalToken}`');
  expect(proof).toContain('canaryResponse.status() !== 200');
  expect(proof).toContain('LIVE_SUPPORT_CANARY_DISPATCH_ACCEPTED');
  expect(proof).not.toContain('SUPPORT_PROOF_EMAIL');
  expect(proof).not.toContain("page.request.post(`${baseUrl}/api/support`");
});

test('Hostinger support proof uses the existing internal operations secret and no caller-selected support address', () => {
  expect(workflow).toContain('EXPECTED_RELEASE_ID: ${{ github.sha }}');
  expect(workflow).toContain('INTERNAL_OPERATIONS_TOKEN: ${{ secrets.INTERNAL_OPERATIONS_TOKEN }}');
  expect(workflow).not.toContain('LIVE_SUPPORT_EMAIL');
  expect(workflow).toContain('node tests/e2e/live-support-proof.mjs');
  expect(proof).not.toMatch(/console\.log\([^\n]*internalToken/);
});
