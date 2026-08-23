import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('Owner OS payment recovery dispatches design through effective policy and provider fallback', () => {
  const source = readFileSync('src/server/ops/runtimeOwnerOs.ts', 'utf8');
  const recovery = source.slice(source.indexOf('export function createOpsRecoveryService()'));

  expect(source).toMatch(/import \{ dispatchPaidIssueDesign \} from '@\/server\/design\/designDispatch';/);
  expect(recovery).toMatch(/enqueueDesign:\s*\(issueId\)\s*=>\s*dispatchPaidIssueDesign\(issueId\)/);
  expect(recovery).not.toMatch(/enqueueDesignIssue\(issueId\)/);
});
