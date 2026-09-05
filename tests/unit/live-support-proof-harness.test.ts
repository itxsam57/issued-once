import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const proof = readFileSync(join(process.cwd(), 'tests/e2e/live-support-proof.mjs'), 'utf8');
const workflow = readFileSync(join(process.cwd(), '.github/workflows/hostinger-live-support-proof.yml'), 'utf8');

test('live support proof preserves the pre-order fail-closed boundary', () => {
  expect(proof).toContain('/api/support');
  expect(proof).toContain('supportResponse.status() !== 409');
  expect(proof).toContain('LIVE_PREORDER_SUPPORT_FAIL_CLOSED_PASS');
});

test('live support proof invokes the authenticated canary for the exact deployed release', () => {
  expect(proof).toContain('process.env.EXPECTED_RELEASE_ID');
  expect(proof).toContain('process.env.INTERNAL_OPERATIONS_TOKEN');
  expect(proof).toContain('/api/internal/support-canary');
  expect(proof).toContain("authorization: `Bearer ${internalToken}`");
  expect(proof).toContain('releaseId: expectedReleaseId');
  expect(proof).toContain('canaryResponse.status() !== 200');
  expect(proof).toContain('LIVE_SUPPORT_DELIVERY_CANARY_ACCEPTED');
});

test('Hostinger support proof wires the existing internal operations secret without exposing it', () => {
  expect(workflow).toContain('EXPECTED_RELEASE_ID: ${{ github.sha }}');
  expect(workflow).toContain('INTERNAL_OPERATIONS_TOKEN: ${{ secrets.INTERNAL_OPERATIONS_TOKEN }}');
  expect(workflow).toContain('node tests/e2e/live-support-proof.mjs');
  expect(proof).not.toMatch(/console\.log\([^\n]*internalToken/);
});
