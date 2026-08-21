// @vitest-environment node

import { expect, test, vi } from 'vitest';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { DesignDispatchService } from '@/server/design/designDispatch';

const issueId = '11111111-1111-4111-8111-111111111111';

function service(mode: 'AUTO' | 'MANUAL' | 'HYBRID') {
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const policies = {
    getEffective: vi.fn().mockResolvedValue({
      globalVersion: 7,
      override: null,
      policy: { ...DEFAULT_DESIGN_POLICY, mode },
    }),
  };
  return { service: new DesignDispatchService(policies, { enqueue }), enqueue, policies };
}

test('MANUAL paid-Issue policy leaves design actionable without enqueueing AI', async () => {
  const { service: dispatch, enqueue, policies } = service('MANUAL');

  await expect(dispatch.dispatchPaidIssueDesign(issueId)).resolves.toEqual({
    mode: 'MANUAL',
    queued: false,
    policyVersion: 7,
  });
  expect(policies.getEffective).toHaveBeenCalledWith(issueId);
  expect(enqueue).not.toHaveBeenCalled();
});

test.each(['AUTO', 'HYBRID'] as const)('%s paid-Issue policy enqueues one design job', async (mode) => {
  const { service: dispatch, enqueue } = service(mode);

  await expect(dispatch.dispatchPaidIssueDesign(issueId)).resolves.toEqual({
    mode,
    queued: true,
    policyVersion: 7,
  });
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(enqueue).toHaveBeenCalledWith(issueId);
});
