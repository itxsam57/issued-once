import { expect, test } from 'vitest';
import { OpsManufacturingService } from '@/server/ops/OpsManufacturingService';

test('audits factory draft creation without weakening provider action', async () => {
  const events: unknown[] = [];
  const service = new OpsManufacturingService({
    listQueue: async () => [],
    quarantine: async () => undefined,
  }, {
    createDraft: async () => ({ id: 'm1', issueId: '11111111-1111-1111-1111-111111111111', state: 'DRAFT', providerOrderId: 'pf1' }),
    confirmDraft: async () => ({ id: 'm1', issueId: '11111111-1111-1111-1111-111111111111', state: 'IN_PRODUCTION' }),
  }, { record: async (event) => { events.push(event); } } as never);

  const result = await service.createDraft('11111111-1111-1111-1111-111111111111');
  expect(result.state).toBe('DRAFT');
  expect(JSON.stringify(events)).toContain('PRINTFUL_DRAFT_CREATED');
});
