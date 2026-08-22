import { expect, test } from 'vitest';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { OpsDesignPolicyService } from '@/server/ops/OpsDesignPolicyService';

test('publishes a global design policy and audits the control change', async () => {
  const calls: unknown[] = [];
  const service = new OpsDesignPolicyService({
    getGlobal: async () => ({ source: 'DEFAULT' as const, version: 0, policy: DEFAULT_DESIGN_POLICY }),
    getEffective: async () => ({ globalVersion: 0, override: null, policy: DEFAULT_DESIGN_POLICY }),
    publishGlobal: async (policy) => { calls.push({ policy }); return 3; },
    setIssueOverride: async () => undefined,
  }, { record: async (event: unknown) => { calls.push(event); } } as never);

  const policy = { ...DEFAULT_DESIGN_POLICY, mode: 'MANUAL' as const };
  await expect(service.publishGlobal(policy)).resolves.toEqual({ version: 3, policy });
  expect(calls[0]).toEqual({ policy });
  expect(JSON.stringify(calls[1])).toContain('DESIGN_POLICY_GLOBAL_PUBLISHED');
  expect(JSON.stringify(calls[1])).not.toMatch(/answer|email|shipping/i);
});

test('sets and clears a per-Issue override with audit evidence', async () => {
  const calls: unknown[] = [];
  let current: { mode?: 'AUTO' | 'MANUAL' | 'HYBRID' } | null = null;
  const service = new OpsDesignPolicyService({
    getGlobal: async () => ({ source: 'ACTIVE' as const, version: 8, policy: DEFAULT_DESIGN_POLICY }),
    getEffective: async () => ({
      globalVersion: 8,
      override: current,
      policy: { ...DEFAULT_DESIGN_POLICY, ...(current ?? {}) },
    }),
    publishGlobal: async () => 9,
    setIssueOverride: async (_issueId, override) => { current = override; calls.push({ override }); },
  }, { record: async (event: unknown) => { calls.push(event); } } as never);
  const issueId = '11111111-1111-4111-8111-111111111111';

  const set = await service.setIssueOverride(issueId, { mode: 'MANUAL' });
  expect(set.policy.mode).toBe('MANUAL');
  expect(JSON.stringify(calls)).toContain('DESIGN_POLICY_OVERRIDE_SET');

  const cleared = await service.setIssueOverride(issueId, null);
  expect(cleared.policy.mode).toBe(DEFAULT_DESIGN_POLICY.mode);
  expect(JSON.stringify(calls)).toContain('DESIGN_POLICY_OVERRIDE_CLEARED');
});
