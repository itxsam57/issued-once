import { expect, test, vi } from 'vitest';
import { PostgresReferralLifecycleRepository } from '@/server/referrals/PostgresReferralLifecycleRepository';

const conversion = {
  id: '22222222-2222-4222-8222-222222222222',
  creator_id: '33333333-3333-4333-8333-333333333333',
  reward_amount_minor: 972,
  currency: 'USD',
};
const at = new Date('2026-08-21T13:00:00.000Z');

test('delivery compare-and-set can move only PENDING reward to AVAILABLE', async () => {
  const query = vi.fn().mockResolvedValue([{ ...conversion, state: 'AVAILABLE' }]);
  const repository = new PostgresReferralLifecycleRepository({ query });

  await expect(repository.markAvailableByIssueId('11111111-1111-4111-8111-111111111111', at))
    .resolves.toEqual({
      kind: 'updated',
      conversion: {
        id: conversion.id,
        creatorId: conversion.creator_id,
        rewardAmountMinor: 972,
        currency: 'USD',
        state: 'AVAILABLE',
      },
    });

  const [statement, params] = query.mock.calls[0] as [string, readonly unknown[]];
  expect(statement).toMatch(/UPDATE referral_conversions/i);
  expect(statement).toMatch(/state\s*=\s*'AVAILABLE'/i);
  expect(statement).toMatch(/WHERE issue_id\s*=\s*\$1::uuid[\s\S]*state\s*=\s*'PENDING'/i);
  expect(statement).toMatch(/available_at\s*=\s*COALESCE\(available_at,\s*\$2\)/i);
  expect(params).toEqual(['11111111-1111-4111-8111-111111111111', at]);
});

test('delivery replay rereads canonical state and never reopens REVERSED reward', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...conversion, state: 'REVERSED' }]);
  const repository = new PostgresReferralLifecycleRepository({ query });

  await expect(repository.markAvailableByIssueId('11111111-1111-4111-8111-111111111111', at))
    .resolves.toEqual({
      kind: 'duplicate',
      conversion: expect.objectContaining({ id: conversion.id, state: 'REVERSED' }),
    });
  expect(query).toHaveBeenCalledTimes(2);
  expect(String(query.mock.calls[1]?.[0])).toMatch(/WHERE issue_id\s*=\s*\$1::uuid/i);
});

test('refund reverses PENDING AVAILABLE or PAID_OUT while preserving an audit trail', async () => {
  const query = vi.fn().mockResolvedValue([{ ...conversion, state: 'REVERSED' }]);
  const repository = new PostgresReferralLifecycleRepository({ query });

  await expect(repository.reverseByPaymentAttemptId('attempt-1', at)).resolves.toEqual({
    kind: 'updated',
    conversion: expect.objectContaining({ id: conversion.id, state: 'REVERSED' }),
  });

  const [statement, params] = query.mock.calls[0] as [string, readonly unknown[]];
  expect(statement).toMatch(/state\s*=\s*'REVERSED'/i);
  expect(statement).toMatch(/reversed_at\s*=\s*COALESCE\(reversed_at,\s*\$2\)/i);
  expect(statement).toMatch(/state\s+IN\s*\(\s*'PENDING'\s*,\s*'AVAILABLE'\s*,\s*'PAID_OUT'\s*\)/i);
  expect(params).toEqual(['attempt-1', at]);
});

test('refund replay rereads REVERSED conversion and non-referred refund stays a no-op', async () => {
  const replayQuery = vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...conversion, state: 'REVERSED' }]);
  const replayRepository = new PostgresReferralLifecycleRepository({ query: replayQuery });
  await expect(replayRepository.reverseByPaymentAttemptId('attempt-1', at)).resolves.toEqual({
    kind: 'duplicate',
    conversion: expect.objectContaining({ id: conversion.id, state: 'REVERSED' }),
  });

  const missingQuery = vi.fn().mockResolvedValue([]);
  const missingRepository = new PostgresReferralLifecycleRepository({ query: missingQuery });
  await expect(missingRepository.reverseByPaymentAttemptId('attempt-plain', at))
    .resolves.toEqual({ kind: 'not-referred' });
});
