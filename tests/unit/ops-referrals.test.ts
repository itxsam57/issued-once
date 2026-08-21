import { expect, test, vi } from 'vitest';
import { OpsReferralService } from '@/server/ops/OpsReferralService';
import type { ReferralRules } from '@/server/referrals/ReferralPolicy';

const now = new Date('2026-08-21T13:30:00.000Z');
const rules: ReferralRules = {
  customerDiscount: { mode: 'PERCENT', basisPoints: 1000 },
  creatorReward: { mode: 'PERCENT', basisPoints: 2000 },
  payoutCadence: 'THRESHOLD',
  payoutThresholdMinor: 2500,
  attributionWindowDays: 30,
};
const encrypted = {
  version: 1 as const,
  keyVersion: 'v1' as const,
  iv: 'iv',
  ciphertext: 'ciphertext',
  tag: 'tag',
};

function setup() {
  const repository = {
    listCreators: vi.fn().mockResolvedValue([
      {
        creatorId: 'creator-1',
        displayName: 'Creator One',
        normalizedCode: 'CREATOR-ONE',
        active: true,
        ruleVersionId: 'rule-2',
        ruleVersion: 2,
        rules,
        salesCount: 4,
        balances: [
          { currency: 'USD', pendingMinor: 972, availableMinor: 2916, paidOutMinor: 1000, reversedMinor: 500 },
        ],
      },
    ]),
    createCreator: vi.fn().mockResolvedValue({ creatorId: 'creator-new', ruleVersionId: 'rule-new' }),
    updateCreator: vi.fn().mockResolvedValue({ creatorId: 'creator-1', ruleVersionId: 'rule-3', ruleVersion: 3 }),
    setCreatorActive: vi.fn().mockResolvedValue(true),
    createPayoutFromAvailable: vi.fn().mockResolvedValue({
      payoutId: 'payout-1', creatorId: 'creator-1', currency: 'USD', requestedAmountMinor: 2916, conversionCount: 3, status: 'REQUESTED' as const,
    }),
    getPayoutEncryptedDetails: vi.fn().mockResolvedValue({
      payoutId: 'payout-1', creatorId: 'creator-1', status: 'REQUESTED' as const, encryptedDetails: encrypted,
    }),
    settlePayout: vi.fn().mockResolvedValue({
      payoutId: 'payout-1', creatorId: 'creator-1', currency: 'USD', paidAmountMinor: 2916, conversionCount: 3, status: 'PAID' as const,
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const encrypt = vi.fn().mockResolvedValue(encrypted);
  const decrypt = vi.fn().mockResolvedValue({ method: 'bank', accountName: 'Creator One', accountRef: 'PK00-PRIVATE' });
  const hashEmail = vi.fn().mockReturnValue('a'.repeat(64));
  const createId = vi.fn((kind: 'creator' | 'rule' | 'payout') => ({
    creator: 'creator-new',
    rule: 'rule-new',
    payout: 'payout-1',
  })[kind]);
  const service = new OpsReferralService({
    repository,
    audit,
    encrypt,
    decrypt,
    hashEmail,
    now: () => now,
    createId,
  });
  return { service, repository, audit, encrypt, decrypt, hashEmail, createId };
}

test('Owner OS lists safe creator rules, referral links, sales, balances and payout readiness without private creator data', async () => {
  const { service } = setup();
  const result = await service.listCreators();

  expect(result).toEqual([
    expect.objectContaining({
      creatorId: 'creator-1',
      displayName: 'Creator One',
      code: 'CREATOR-ONE',
      referralPath: '/r/CREATOR-ONE',
      active: true,
      ruleVersion: 2,
      rules,
      salesCount: 4,
      balances: [expect.objectContaining({
        currency: 'USD',
        pendingMinor: 972,
        availableMinor: 2916,
        paidOutMinor: 1000,
        reversedMinor: 500,
        payoutReady: true,
      })],
    }),
  ]);
  expect(JSON.stringify(result)).not.toMatch(/email|ciphertext|accountRef|PK00/i);
});

test('creator creation encrypts email and stores only its hash plus first immutable rule version', async () => {
  const { service, repository, encrypt, hashEmail, createId } = setup();

  await service.createCreator({
    displayName: 'New Creator',
    email: 'creator@example.com',
    code: 'new-creator',
    rules,
  });

  expect(createId).toHaveBeenCalledWith('creator');
  expect(createId).toHaveBeenCalledWith('rule');
  expect(encrypt).toHaveBeenCalledWith({ email: 'creator@example.com' });
  expect(hashEmail).toHaveBeenCalledWith('creator@example.com');
  expect(repository.createCreator).toHaveBeenCalledWith(expect.objectContaining({
    creatorId: 'creator-new',
    ruleVersionId: 'rule-new',
    displayName: 'New Creator',
    emailHash: 'a'.repeat(64),
    encryptedEmail: encrypted,
    code: 'NEW-CREATOR',
    rules,
    active: true,
    now,
  }));
});

test('editing economics creates a new immutable rule version while pause is a separate creator-state change', async () => {
  const { service, repository, createId } = setup();
  const nextRules: ReferralRules = {
    ...rules,
    creatorReward: { mode: 'FIXED', amountMinor: 700 },
  };

  await service.updateCreator('creator-1', {
    displayName: 'Creator One',
    code: 'creator-one',
    rules: nextRules,
  });
  await service.setCreatorActive('creator-1', false);

  expect(createId).toHaveBeenCalledWith('rule');
  expect(repository.updateCreator).toHaveBeenCalledWith(expect.objectContaining({
    creatorId: 'creator-1',
    ruleVersionId: 'rule-new',
    displayName: 'Creator One',
    code: 'CREATOR-ONE',
    rules: nextRules,
    now,
  }));
  expect(repository.setCreatorActive).toHaveBeenCalledWith('creator-1', false, now);
});

test('manual payout request encrypts details and repository allocates only currently AVAILABLE earnings atomically', async () => {
  const { service, repository, encrypt, audit, createId } = setup();
  const result = await service.requestPayout({
    creatorId: 'creator-1',
    currency: 'USD',
    details: { method: 'bank', accountName: 'Creator One', accountRef: 'PK00-PRIVATE' },
    reason: 'Monthly creator settlement',
  });

  expect(createId).toHaveBeenCalledWith('payout');
  expect(encrypt).toHaveBeenCalledWith({ method: 'bank', accountName: 'Creator One', accountRef: 'PK00-PRIVATE' });
  expect(repository.createPayoutFromAvailable).toHaveBeenCalledWith(expect.objectContaining({
    payoutId: 'payout-1', creatorId: 'creator-1', currency: 'USD', encryptedDetails: encrypted, requestedAt: now,
  }));
  expect(result.requestedAmountMinor).toBe(2916);
  expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
    actor: 'OWNER', action: 'OPS_REFERRAL_PAYOUT_REQUEST', targetType: 'referral_payout', targetId: 'payout-1',
  }));
});

test('payout details require a reason, decrypt only on explicit reveal, and reveal is audited without leaking details into audit metadata', async () => {
  const { service, audit, decrypt } = setup();

  await expect(service.revealPayoutDetails({ payoutId: 'payout-1', reason: '' })).rejects.toThrow(/reason/i);
  const revealed = await service.revealPayoutDetails({ payoutId: 'payout-1', reason: 'Verify destination before settlement' });

  expect(decrypt).toHaveBeenCalledWith(encrypted);
  expect(revealed).toEqual({ method: 'bank', accountName: 'Creator One', accountRef: 'PK00-PRIVATE' });
  expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
    actor: 'OWNER', action: 'OPS_REFERRAL_PAYOUT_REVEAL', targetType: 'referral_payout', targetId: 'payout-1',
    reason: 'Verify destination before settlement',
    safeMetadata: { creatorId: 'creator-1', status: 'REQUESTED' },
  }));
});

test('mark-paid delegates to atomic AVAILABLE-only settlement and records an owner audit receipt', async () => {
  const { service, repository, audit } = setup();
  const result = await service.markPayoutPaid({ payoutId: 'payout-1', reason: 'Bank transfer confirmed' });

  expect(repository.settlePayout).toHaveBeenCalledWith('payout-1', now);
  expect(result).toEqual(expect.objectContaining({ status: 'PAID', paidAmountMinor: 2916, conversionCount: 3 }));
  expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
    actor: 'OWNER', action: 'OPS_REFERRAL_PAYOUT_PAID', targetType: 'referral_payout', targetId: 'payout-1',
    reason: 'Bank transfer confirmed',
    safeMetadata: { creatorId: 'creator-1', currency: 'USD', paidAmountMinor: 2916, conversionCount: 3 },
  }));
});
