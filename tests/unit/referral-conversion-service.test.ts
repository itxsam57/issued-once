import { expect, test, vi } from 'vitest';
import { ReferralConversionService } from '@/server/referrals/ReferralConversionService';
import type { PaidReferralTruth } from '@/server/referrals/ReferralRepository';

const now = new Date('2026-08-21T12:15:00.000Z');
const rules = {
  customerDiscount: { mode: 'PERCENT' as const, basisPoints: 1000 },
  creatorReward: { mode: 'PERCENT' as const, basisPoints: 2000 },
  payoutCadence: 'THRESHOLD' as const,
  payoutThresholdMinor: 2500,
  attributionWindowDays: 30,
};

const paidTruth: PaidReferralTruth = {
  paymentAttemptId: 'payment-ref-1',
  creatorId: 'creator-1',
  ruleVersionId: 'rule-1',
  grossAmountMinor: 5400,
  discountAmountMinor: 540,
  paidAmountMinor: 4860,
  currency: 'USD',
  ruleSnapshot: { code: 'CREATOR-ONE', rules },
};

function setup(truth: PaidReferralTruth | null = paidTruth) {
  const repository = {
    loadPaidReferralTruth: vi.fn().mockResolvedValue(truth),
    createConversion: vi.fn().mockImplementation(async (input) => ({
      kind: 'created' as const,
      conversion: input,
    })),
  };
  const service = new ReferralConversionService({
    repository,
    now: () => now,
    createConversionId: () => 'conversion-1',
  });
  return { service, repository };
}

test('persisted PAID referral truth creates a PENDING conversion and percentage reward derives from paid amount', async () => {
  const { service, repository } = setup();

  await expect(
    service.recordPaidAttempt({ paymentAttemptId: 'payment-ref-1', issueId: 'issue-1' }),
  ).resolves.toEqual({
    kind: 'created',
    conversionId: 'conversion-1',
    creatorId: 'creator-1',
    rewardAmountMinor: 972,
    currency: 'USD',
  });

  expect(repository.loadPaidReferralTruth).toHaveBeenCalledWith('payment-ref-1');
  expect(repository.createConversion).toHaveBeenCalledWith({
    id: 'conversion-1',
    creatorId: 'creator-1',
    ruleVersionId: 'rule-1',
    paymentAttemptId: 'payment-ref-1',
    issueId: 'issue-1',
    grossAmountMinor: 5400,
    discountAmountMinor: 540,
    paidAmountMinor: 4860,
    rewardAmountMinor: 972,
    currency: 'USD',
    ruleSnapshot: { code: 'CREATOR-ONE', rules },
    state: 'PENDING',
    convertedAt: now,
    updatedAt: now,
  });
});

test('fixed creator reward remains the exact frozen configured amount', async () => {
  const fixedRules = {
    ...rules,
    creatorReward: { mode: 'FIXED' as const, amountMinor: 500 },
  };
  const { service, repository } = setup({
    ...paidTruth,
    ruleSnapshot: { code: 'CREATOR-ONE', rules: fixedRules },
  });

  await service.recordPaidAttempt({ paymentAttemptId: 'payment-ref-1', issueId: 'issue-1' });

  expect(repository.createConversion).toHaveBeenCalledWith(
    expect.objectContaining({ rewardAmountMinor: 500 }),
  );
});

test('an attempt without persisted paid referral truth creates no conversion', async () => {
  const { service, repository } = setup(null);

  await expect(
    service.recordPaidAttempt({ paymentAttemptId: 'payment-no-referral', issueId: 'issue-2' }),
  ).resolves.toEqual({ kind: 'not-referred' });
  expect(repository.createConversion).not.toHaveBeenCalled();
});

test('provider replay resolves to the existing conversion instead of double-counting reward', async () => {
  const { service, repository } = setup();
  vi.mocked(repository.createConversion)
    .mockResolvedValueOnce({
      kind: 'created',
      conversion: {
        id: 'conversion-1',
        creatorId: 'creator-1',
        rewardAmountMinor: 972,
        currency: 'USD',
      },
    })
    .mockResolvedValueOnce({
      kind: 'duplicate',
      conversion: {
        id: 'conversion-1',
        creatorId: 'creator-1',
        rewardAmountMinor: 972,
        currency: 'USD',
      },
    });

  const first = await service.recordPaidAttempt({ paymentAttemptId: 'payment-ref-1', issueId: 'issue-1' });
  const replay = await service.recordPaidAttempt({ paymentAttemptId: 'payment-ref-1', issueId: 'issue-1' });

  expect(first).toEqual(expect.objectContaining({ kind: 'created', conversionId: 'conversion-1' }));
  expect(replay).toEqual(expect.objectContaining({ kind: 'duplicate', conversionId: 'conversion-1' }));
  expect(repository.createConversion).toHaveBeenCalledTimes(2);
});
