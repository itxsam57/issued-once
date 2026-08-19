import { expect, test, vi } from 'vitest';
import { ManufacturingEventService } from '@/server/manufacturing/ManufacturingEventService';
import type { ManufacturingEventRepository } from '@/server/manufacturing/ManufacturingEventRepository';
import type { PrintfulWebhookVerifier } from '@/server/manufacturing/PrintfulWebhookVerifier';

const event = {
  providerEventId: 'evt-stable',
  type: 'SHIPMENT_SENT' as const,
  providerOrderId: '987654',
  externalIssueCode: 'IO-ABCD-EFGH',
  providerStatus: 'fulfilled',
  trackingNumber: 'TRACK-1',
  trackingUrl: 'https://carrier.example/T1',
  occurredAt: new Date('2026-08-19T03:00:00Z'),
  shippedAt: new Date('2026-08-19T03:00:00Z'),
  deliveredAt: null,
  reason: null,
};

const issueId = '11111111-1111-4111-8111-111111111111';

test('verified shipment applies exactly once and duplicate retries preserve Issue identity for downstream recovery', async () => {
  const verifier = { verify: vi.fn(() => event) } as unknown as PrintfulWebhookVerifier;
  let called = 0;
  const repository: ManufacturingEventRepository = {
    applyProviderEvent: vi.fn(async () => ({
      kind: ++called === 1 ? 'applied' as const : 'duplicate' as const,
      issueId,
    })),
  };
  const service = new ManufacturingEventService(verifier, repository);
  expect(await service.handle({ rawBody: '{}', headers: new Headers() })).toEqual({
    kind: 'applied', issueId, eventType: 'SHIPMENT_SENT',
  });
  expect(await service.handle({ rawBody: '{}', headers: new Headers() })).toEqual({
    kind: 'duplicate', issueId, eventType: 'SHIPMENT_SENT',
  });
});

test('cross-link mismatch is quarantined rather than silently accepted', async () => {
  const verifier = { verify: vi.fn(() => event) } as unknown as PrintfulWebhookVerifier;
  const repository: ManufacturingEventRepository = {
    applyProviderEvent: vi.fn(async () => ({ kind: 'mismatch' as const, issueId })),
  };
  await expect(new ManufacturingEventService(verifier, repository).handle({ rawBody: '{}', headers: new Headers() }))
    .rejects.toThrow(/mismatch|cross/i);
});
