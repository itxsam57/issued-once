import { expect, test } from 'vitest';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { PostgresDesignPolicyRepository } from '@/server/design/PostgresDesignPolicyRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

test('uses safe defaults when no global design policy has been published', async () => {
  const sql: SqlExecutor = { query: async () => [] as never };
  const repository = new PostgresDesignPolicyRepository(sql);

  await expect(repository.getGlobal()).resolves.toEqual({
    source: 'DEFAULT',
    version: 0,
    policy: DEFAULT_DESIGN_POLICY,
  });
});

test('per-Issue override takes precedence over the active global policy', async () => {
  const calls: string[] = [];
  const sql: SqlExecutor = { query: async (query) => {
    calls.push(query);
    if (query.includes("config_type='DESIGN_POLICY'")) {
      return [{ version: 4, payload: { ...DEFAULT_DESIGN_POLICY, mode: 'AUTO', rejectBehavior: 'AUTO_REGENERATE' } }] as never;
    }
    if (query.includes('issue_design_policy_overrides')) {
      return [{ payload: { mode: 'MANUAL', approvalRequired: true } }] as never;
    }
    return [] as never;
  }};
  const repository = new PostgresDesignPolicyRepository(sql);

  const effective = await repository.getEffective('10000000-0000-4000-8000-000000000001');
  expect(effective.globalVersion).toBe(4);
  expect(effective.override).toEqual({ mode: 'MANUAL', approvalRequired: true });
  expect(effective.policy.mode).toBe('MANUAL');
  expect(effective.policy.rejectBehavior).toBe('AUTO_REGENERATE');
  expect(calls.length).toBe(2);
});

test('publishes validated global policy as a new active DESIGN_POLICY version', async () => {
  const params: Array<readonly unknown[]> = [];
  const sql: SqlExecutor = { query: async (_query, nextParams) => {
    params.push(nextParams ?? []);
    return [{ version: 7 }] as never;
  }};
  const repository = new PostgresDesignPolicyRepository(sql);

  await expect(repository.publishGlobal({ ...DEFAULT_DESIGN_POLICY, mode: 'MANUAL' })).resolves.toBe(7);
  expect(JSON.parse(String(params[0][0]))).toMatchObject({ mode: 'MANUAL' });
});

test('stores only validated partial per-Issue overrides and supports clearing them', async () => {
  const calls: Array<{ query: string; params: readonly unknown[] }> = [];
  const sql: SqlExecutor = { query: async (query, params = []) => {
    calls.push({ query, params });
    return [] as never;
  }};
  const repository = new PostgresDesignPolicyRepository(sql);
  const issueId = '10000000-0000-4000-8000-000000000001';

  await repository.setIssueOverride(issueId, { mode: 'MANUAL', answerRevealDefault: 'VISIBLE' });
  await repository.setIssueOverride(issueId, null);

  expect(calls[0].query).toMatch(/issue_design_policy_overrides/i);
  expect(JSON.parse(String(calls[0].params[1]))).toEqual({ mode: 'MANUAL', answerRevealDefault: 'VISIBLE' });
  expect(calls[1].query).toMatch(/delete/i);
  await expect(repository.setIssueOverride(issueId, { mode: 'MAGIC' as never })).rejects.toThrow(/design policy override/i);
});
