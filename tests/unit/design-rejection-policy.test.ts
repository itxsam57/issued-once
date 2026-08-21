// @vitest-environment node

import { expect, test, vi } from 'vitest';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { OpsDesignerService } from '@/server/ops/OpsDesignerService';

const issueId = '11111111-1111-4111-8111-111111111111';

function setup(rejectBehavior: 'AUTO_REGENERATE' | 'WAIT_FOR_OWNER') {
  const prepareRework = vi.fn().mockResolvedValue({ issueId, generationKey: 'gen-2', mode: 'regenerate' as const });
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const events: unknown[] = [];
  const service = new OpsDesignerService(
    {
      listQueue: async () => [],
      prepareRework,
      prepareRetry: async () => ({ issueId, generationKey: 'retry-1' }),
      selectCandidate: async () => undefined,
    },
    { approve: async () => undefined, enqueue },
    { record: async (event: unknown) => { events.push(event); } } as never,
    {
      getEffective: vi.fn().mockResolvedValue({
        globalVersion: 5,
        override: null,
        policy: { ...DEFAULT_DESIGN_POLICY, rejectBehavior },
      }),
    },
  );
  return { service, prepareRework, enqueue, events };
}

test('WAIT_FOR_OWNER rejection records feedback without starting another generation', async () => {
  const { service, prepareRework, enqueue, events } = setup('WAIT_FOR_OWNER');

  await expect(service.reject({ issueId, reason: 'WRONG_MOOD — colder and quieter', next: 'regenerate' })).resolves.toEqual({
    issueId,
    queued: false,
    policyVersion: 5,
  });
  expect(prepareRework).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
  expect(JSON.stringify(events)).toContain('WAIT_FOR_OWNER');
});

test('AUTO_REGENERATE rejection queues the requested next pass and preserves feedback in queue and audit', async () => {
  const { service, prepareRework, enqueue, events } = setup('AUTO_REGENERATE');
  const reason = 'TOO_BUSY — simplify the center';

  await expect(service.reject({ issueId, reason, next: 'regenerate' })).resolves.toMatchObject({
    issueId,
    generationKey: 'gen-2',
    queued: true,
    policyVersion: 5,
  });
  expect(prepareRework).toHaveBeenCalledWith(issueId, 'regenerate');
  expect(enqueue).toHaveBeenCalledWith(issueId, 'regenerate', 'gen-2', reason);
  expect(JSON.stringify(events)).toContain('TOO_BUSY');
});
