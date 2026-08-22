import { expect, test } from 'vitest';
import { OpsAuditService } from '@/server/ops/OpsAuditService';

test('records a safe owner action', async () => {
  const written: unknown[] = [];
  const service = new OpsAuditService({
    append: async (event) => { written.push(event); },
    listRecent: async () => ({ items: [], nextCursor: null }),
  });

  await service.record({
    actor: 'OWNER',
    action: 'DESIGN_APPROVED',
    issueId: '11111111-1111-1111-1111-111111111111',
    targetType: 'design_job',
    targetId: 'd1',
    reason: null,
    safeMetadata: { state: 'APPROVED' },
  });

  expect(written).toHaveLength(1);
});

test('rejects private plaintext metadata before persistence', async () => {
  const service = new OpsAuditService({
    append: async () => undefined,
    listRecent: async () => ({ items: [], nextCursor: null }),
  });

  await expect(service.record({
    actor: 'OWNER',
    action: 'OPS_PRIVATE_REVEAL',
    issueId: '11111111-1111-1111-1111-111111111111',
    targetType: 'issue',
    targetId: '11111111-1111-1111-1111-111111111111',
    reason: 'customer support',
    safeMetadata: { email: 'private@example.com' },
  })).rejects.toThrow(/private metadata/i);
});
