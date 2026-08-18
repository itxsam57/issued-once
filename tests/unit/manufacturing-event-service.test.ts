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

test('verified shipment applies exactly once and duplicates are harmless', async () => {
  const verifier = { verify: vi.fn(() => event) } as unknown as PrintfulWebhookVerifier;
  let called = 0;
  const repository: ManufacturingEventRepository = {
    applyProviderEvent: vi.fn(async () => (++called === 1 ? 'applied' as const : 'duplicate' as const)),
  };
  const service = new ManufacturingEventService(verifier, repository);
  expect(await service.handle({ rawBody: '{}', headers: new Headers() })).toEqual({ kind: 'applied' });
  expect(await service.handle({ rawBody: '{}', headers: new Headers() })).toEqual({ kind: 'duplicate' });
});

test('cross-link mismatch is quarantined rather than silently accepted', async () => {
  const verifier = { verify: vi.fn(() => event) } as unknown as PrintfulWebhookVerifier;
  const repository: ManufacturingEventRepository = {
    applyProviderEvent: vi.fn(async () => 'mismatch' as const),
  };
  await expect(new ManufacturingEventService(verifier, repository).handle({ rawBody: '{}', headers: new Headers() }))
    .rejects.toThrow(/mismatch|cross/i);
});
