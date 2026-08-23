import { expect, test } from 'vitest';
import type { ManufacturingJobRecord } from '@/server/manufacturing/ManufacturingRepository';
import { OpsManufacturingService } from '@/server/ops/OpsManufacturingService';

const issueId = '11111111-1111-1111-1111-111111111111';

function manufacturingJob(state: ManufacturingJobRecord['state']): ManufacturingJobRecord {
  const now = new Date('2026-08-19T06:00:00Z');
  return {
    id: 'm1', issueId, designJobId: 'design-1', state, provider: 'PRINTFUL',
    providerOrderId: 'pf1', providerStatus: state, printfulVariantId: 4012,
    artworkUrl: 'https://blob.example/art.png', createdAt: now, updatedAt: now,
    confirmedAt: state === 'IN_PRODUCTION' ? now : null,
  };
}

test('audits factory draft creation without weakening provider action', async () => {
  const events: unknown[] = [];
  const service = new OpsManufacturingService({
    listQueue: async () => [],
    quarantine: async () => undefined,
  }, {
    createDraft: async () => manufacturingJob('DRAFT'),
    confirmDraft: async () => manufacturingJob('IN_PRODUCTION'),
  }, { record: async (event: unknown) => { events.push(event); } } as never);

  const result = await service.createDraft(issueId);
  expect(result.state).toBe('DRAFT');
  expect(JSON.stringify(events)).toContain('PRINTFUL_DRAFT_CREATED');
});
