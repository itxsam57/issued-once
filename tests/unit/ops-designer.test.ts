import { expect, test } from 'vitest';
import { OpsDesignerService } from '@/server/ops/OpsDesignerService';

test('regeneration is queued as artwork-only rework and audited', async () => {
  const calls: unknown[] = [];
  const service = new OpsDesignerService({
    listQueue: async () => [],
    prepareRework: async (issueId, mode) => ({ issueId, generationKey: 'gen-2', mode }),
    prepareRetry: async () => ({ issueId: 'unused', generationKey: 'unused' }),
    selectCandidate: async () => undefined,
  }, {
    approve: async () => undefined,
    enqueue: async (issueId, mode, generationKey) => { calls.push({ issueId, mode, generationKey }); },
  }, { record: async (event) => { calls.push(event); } } as never);

  await service.rework({ issueId: '11111111-1111-1111-1111-111111111111', mode: 'regenerate', reason: 'composition needs another pass' });

  expect(calls[0]).toEqual({ issueId: '11111111-1111-1111-1111-111111111111', mode: 'regenerate', generationKey: 'gen-2' });
  expect(JSON.stringify(calls)).toContain('DESIGN_REGENERATE');
});

test('retry only uses the FAILED-job retry reservation and is audited', async () => {
  const calls: unknown[] = [];
  const issueId = '11111111-1111-1111-1111-111111111111';
  const service = new OpsDesignerService({
    listQueue: async () => [],
    prepareRework: async () => { throw new Error('rework should not run'); },
    prepareRetry: async (candidateIssueId) => {
      expect(candidateIssueId).toBe(issueId);
      return { issueId, generationKey: 'retry-1' };
    },
    selectCandidate: async () => undefined,
  }, {
    approve: async () => undefined,
    enqueue: async (queuedIssueId, mode, generationKey) => { calls.push({ queuedIssueId, mode, generationKey }); },
  }, { record: async (event) => { calls.push(event); } } as never);

  await service.retryFailed(issueId);

  expect(calls[0]).toEqual({ queuedIssueId: issueId, mode: 'reinterpret', generationKey: 'retry-1' });
  expect(JSON.stringify(calls)).toContain('DESIGN_RETRY');
});
