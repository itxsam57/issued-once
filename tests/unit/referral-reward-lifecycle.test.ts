import { expect, test, vi } from 'vitest';
import { ReferralConversionService } from '@/server/referrals/ReferralConversionService';

const now = new Date('2026-08-21T13:00:00.000Z');
const conversion = {
  id: '22222222-2222-4222-8222-222222222222',
  creatorId: '33333333-3333-4333-8333-333333333333',
  rewardAmountMinor: 972,
  currency: 'USD',
};

function setup() {
  const repository = {
    loadPaidReferralTruth: vi.fn(),
    createConversion: vi.fn(),
    markAvailableByIssueId: vi.fn(),
    reverseByPaymentAttemptId: vi.fn(),
  };
  const service = new ReferralConversionService({ repository, now: () => now });
  return { repository, service };
}

test('signed delivered Issue makes only a PENDING referral reward AVAILABLE', async () => {
  const { repository, service } = setup();
  repository.markAvailableByIssueId.mockResolvedValue({
    kind: 'updated',
    conversion: { ...conversion, state: 'AVAILABLE' as const },
  });

  await expect(service.markDeliveredIssue('issue-1')).resolves.toEqual({
    kind: 'updated',
    conversionId: conversion.id,
    creatorId: conversion.creatorId,
    rewardAmountMinor: 972,
    currency: 'USD',
    state: 'AVAILABLE',
  });
  expect(repository.markAvailableByIssueId).toHaveBeenCalledWith('issue-1', now);
});

test('duplicate delivery is idempotent and cannot reopen a reward already REVERSED by refund', async () => {
  const { repository, service } = setup();
  repository.markAvailableByIssueId.mockResolvedValue({
    kind: 'duplicate',
    conversion: { ...conversion, state: 'REVERSED' as const },
  });

  await expect(service.markDeliveredIssue('issue-1')).resolves.toEqual({
    kind: 'duplicate',
    conversionId: conversion.id,
    creatorId: conversion.creatorId,
    rewardAmountMinor: 972,
    currency: 'USD',
    state: 'REVERSED',
  });
});

test('signed refund reverses a referred reward exactly once and replay resolves the same conversion', async () => {
  const { repository, service } = setup();
  repository.reverseByPaymentAttemptId
    .mockResolvedValueOnce({
      kind: 'updated',
      conversion: { ...conversion, state: 'REVERSED' as const },
    })
    .mockResolvedValueOnce({
      kind: 'duplicate',
      conversion: { ...conversion, state: 'REVERSED' as const },
    });

  await expect(service.reverseRefundedAttempt('attempt-1')).resolves.toEqual({
    kind: 'updated',
    conversionId: conversion.id,
    creatorId: conversion.creatorId,
    rewardAmountMinor: 972,
    currency: 'USD',
    state: 'REVERSED',
  });
  await expect(service.reverseRefundedAttempt('attempt-1')).resolves.toEqual({
    kind: 'duplicate',
    conversionId: conversion.id,
    creatorId: conversion.creatorId,
    rewardAmountMinor: 972,
    currency: 'USD',
    state: 'REVERSED',
  });
  expect(repository.reverseByPaymentAttemptId).toHaveBeenNthCalledWith(1, 'attempt-1', now);
  expect(repository.reverseByPaymentAttemptId).toHaveBeenNthCalledWith(2, 'attempt-1', now);
});

test('non-referred delivery/refund remains a no-op', async () => {
  const { repository, service } = setup();
  repository.markAvailableByIssueId.mockResolvedValue({ kind: 'not-referred' });
  repository.reverseByPaymentAttemptId.mockResolvedValue({ kind: 'not-referred' });

  await expect(service.markDeliveredIssue('issue-plain')).resolves.toEqual({ kind: 'not-referred' });
  await expect(service.reverseRefundedAttempt('attempt-plain')).resolves.toEqual({ kind: 'not-referred' });
});
