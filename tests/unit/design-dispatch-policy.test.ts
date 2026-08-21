// @vitest-environment node

import { expect, test, vi } from 'vitest';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { DesignDispatchService } from '@/server/design/designDispatch';

const issueId = '11111111-1111-4111-8111-111111111111';

function service(mode: 'AUTO' | 'MANUAL' | 'HYBRID', automationReady = true) {
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const reserveManual = vi.fn().mockResolvedValue(undefined);
  const policies = {
    getEffective: vi.fn().mockResolvedValue({
      globalVersion: 7,
      override: null,
      policy: { ...DEFAULT_DESIGN_POLICY, mode },
    }),
  };
  return {
    service: new DesignDispatchService(policies, { enqueue, reserveManual, automationReady: () => automationReady }),
    enqueue,
    reserveManual,
    policies,
  };
}

test('MANUAL paid-Issue policy reserves an actionable design without enqueueing AI', async () => {
  const { service: dispatch, enqueue, reserveManual, policies } = service('MANUAL');

  await expect(dispatch.dispatchPaidIssueDesign(issueId)).resolves.toEqual({
    mode: 'MANUAL',
    queued: false,
    policyVersion: 7,
    fallback: false,
  });
  expect(policies.getEffective).toHaveBeenCalledWith(issueId);
  expect(reserveManual).toHaveBeenCalledOnce();
  expect(reserveManual).toHaveBeenCalledWith(issueId);
  expect(enqueue).not.toHaveBeenCalled();
});

test.each(['AUTO', 'HYBRID'] as const)('%s paid-Issue policy enqueues one design job when automation is ready', async (mode) => {
  const { service: dispatch, enqueue, reserveManual } = service(mode);

  await expect(dispatch.dispatchPaidIssueDesign(issueId)).resolves.toEqual({
    mode,
    queued: true,
    policyVersion: 7,
    fallback: false,
  });
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(enqueue).toHaveBeenCalledWith(issueId);
  expect(reserveManual).not.toHaveBeenCalled();
});

test.each(['AUTO', 'HYBRID'] as const)('%s falls back to an actionable manual reservation when design automation is unavailable', async (mode) => {
  const { service: dispatch, enqueue, reserveManual } = service(mode, false);

  await expect(dispatch.dispatchPaidIssueDesign(issueId)).resolves.toEqual({
    mode,
    queued: false,
    policyVersion: 7,
    fallback: true,
  });
  expect(reserveManual).toHaveBeenCalledWith(issueId);
  expect(enqueue).not.toHaveBeenCalled();
});
