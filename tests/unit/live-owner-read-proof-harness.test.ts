import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const proofPath = 'tests/e2e/live-owner-read-proof.mjs';
const workflowPath = '.github/workflows/hostinger-live-support-proof.yml';

test('live Owner proof exists and is constrained to session login plus read-only Owner surfaces', () => {
  expect(existsSync(proofPath)).toBe(true);
  if (!existsSync(proofPath)) return;
  const proof = readFileSync(proofPath, 'utf8');
  expect(proof).toContain('INTERNAL_OPERATIONS_TOKEN');
  expect(proof).toContain('/api/ops/session');
  for (const path of ['/ops/api/dashboard', '/ops/api/issues?view=ledger&limit=2', '/ops/api/sales?days=30', '/ops/api/customers', '/ops/api/support', '/ops/api/website', '/ops/api/readiness', '/ops/api/audit']) {
    expect(proof).toContain(path);
  }
  for (const forbidden of ['/reveal', '/refund/reconcile', '/manufacturing/confirm', '/manufacturing/create-draft', '/website/catalog/price', '/designer/policy', '/referrals/payouts']) {
    expect(proof).not.toContain(forbidden);
  }
  expect(proof.match(/context\.request\.post\(/g) ?? []).toHaveLength(1);
  expect(proof).not.toMatch(/console\.log\([^\n]*(internalToken|ownerCookie|payload)/);
});

test('isolated proof workflow pins the already-live release instead of pretending the proof branch is deployed', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  expect(workflow).toContain('EXPECTED_RELEASE_ID: 909d84832b345ecd05b03ec30ad06e5c32000908');
  expect(workflow).toContain('node tests/e2e/live-owner-read-proof.mjs');
});
