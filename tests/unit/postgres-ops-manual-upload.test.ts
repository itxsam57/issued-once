import { expect, test } from 'vitest';

import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import { PostgresOpsDesignerStore } from '@/server/ops/PostgresOpsDesignerStore';

test('prepares a manual upload for a paid Issue without requiring a prior AI candidate', async () => {
  const calls: Array<{ query: string; params: readonly unknown[] }> = [];
  const sql: SqlExecutor = {
    query: async (query, params = []) => {
      calls.push({ query, params });
      return [{ design_job_id: '22222222-2222-4222-8222-222222222222', object_type: 'tee' }] as never;
    },
  };
  const store = new PostgresOpsDesignerStore(sql, () => '22222222-2222-4222-8222-222222222222');

  await expect(store.prepareManualUpload('11111111-1111-4111-8111-111111111111')).resolves.toEqual({
    designJobId: '22222222-2222-4222-8222-222222222222',
    objectType: 'tee',
  });

  expect(calls[0].query).toMatch(/design_jobs/i);
  expect(calls[0].query).toMatch(/RECEIVED/);
  expect(calls[0].query).toMatch(/manufacturing_jobs/i);
});

test('saves an OWNER_UPLOAD as the selected review candidate and never bypasses manufacturing state', async () => {
  const calls: Array<{ query: string; params: readonly unknown[] }> = [];
  const sql: SqlExecutor = {
    query: async (query, params = []) => {
      calls.push({ query, params });
      return [{ candidate_id: '33333333-3333-4333-8333-333333333333' }] as never;
    },
  };
  const store = new PostgresOpsDesignerStore(sql);

  await expect(store.saveManualCandidate({
    issueId: '11111111-1111-4111-8111-111111111111',
    designJobId: '22222222-2222-4222-8222-222222222222',
    generationKey: 'owner-upload:test',
    source: 'OWNER_UPLOAD',
    artworkUrl: 'https://manual.private.blob.vercel-storage.com/art.png',
    artworkMimeType: 'image/png',
    artworkBytes: 12000,
    width: 1800,
    height: 2400,
    provider: 'OWNER',
    model: 'MANUAL_UPLOAD',
    safeSummary: 'Owner-uploaded production artwork',
  })).resolves.toEqual({ candidateId: '33333333-3333-4333-8333-333333333333' });

  const sqlText = calls.map((call) => call.query).join('\n');
  expect(sqlText).toMatch(/OWNER_UPLOAD/);
  expect(sqlText).toMatch(/selected\s*=\s*false|selected,false/i);
  expect(sqlText).toMatch(/DESIGN_REVIEW/);
  expect(sqlText).toMatch(/manufacturing_jobs/i);
});
