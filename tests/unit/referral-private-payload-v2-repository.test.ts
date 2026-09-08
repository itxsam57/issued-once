import { expect, test, vi } from 'vitest';
import { PostgresOpsReferralRepository } from '@/server/ops/PostgresOpsReferralRepository';
import { PostgresReferralRepository } from '@/server/referrals/PostgresReferralRepository';

const encryptedV2 = {
  version: 1 as const,
  keyVersion: 'v2' as const,
  iv: 'opaque-v2-iv',
  ciphertext: 'opaque-v2-ciphertext',
  tag: 'opaque-v2-tag',
};

test('referral notification input preserves a V2 encrypted creator email payload', async () => {
  const query = vi.fn().mockResolvedValue([{
    conversion_id: '40000000-0000-4000-8000-000000000001',
    creator_id: '10000000-0000-4000-8000-000000000001',
    email_payload_version: 1,
    email_key_version: 'v2',
    email_iv: encryptedV2.iv,
    email_auth_tag: encryptedV2.tag,
    email_ciphertext: encryptedV2.ciphertext,
    reward_amount_minor: 500,
    currency: 'USD',
    pending_balance_minor: 500,
    available_balance_minor: 0,
  }]);
  const repository = new PostgresReferralRepository({ query });

  const input = await repository.loadNotificationInput('40000000-0000-4000-8000-000000000001');

  expect(input?.encryptedEmail).toEqual(encryptedV2);
  expect(JSON.stringify(input)).not.toContain('@');
});

test('ops payout detail read-back preserves a V2 encrypted payload', async () => {
  const query = vi.fn().mockResolvedValue([{
    payout_id: '30000000-0000-4000-8000-000000000001',
    creator_id: '10000000-0000-4000-8000-000000000001',
    status: 'REQUESTED',
    details_payload_version: 1,
    details_key_version: 'v2',
    details_iv: encryptedV2.iv,
    details_auth_tag: encryptedV2.tag,
    details_ciphertext: encryptedV2.ciphertext,
  }]);
  const repository = new PostgresOpsReferralRepository({ query });

  const record = await repository.getPayoutEncryptedDetails('30000000-0000-4000-8000-000000000001');

  expect(record?.encryptedDetails).toEqual(encryptedV2);
});

test('referral creator and payout writes persist V2 key metadata and ciphertext, never plaintext', async () => {
  const query = vi.fn().mockResolvedValue([]);
  const repository = new PostgresReferralRepository({ query });
  const now = new Date('2026-08-28T06:00:00.000Z');

  await repository.createCreator({
    creatorId: '10000000-0000-4000-8000-000000000001',
    ruleVersionId: '20000000-0000-4000-8000-000000000001',
    displayName: 'Creator V2',
    emailHash: 'a'.repeat(64),
    encryptedEmail: encryptedV2,
    code: 'creator-v2',
    rules: {
      customerDiscount: { mode: 'PERCENT', basisPoints: 1000 },
      creatorReward: { mode: 'FIXED', amountMinor: 500 },
      payoutCadence: 'MONTHLY',
      payoutThresholdMinor: null,
      attributionWindowDays: 30,
    },
    active: true,
    now,
  });
  await repository.createPayoutRequest({
    payoutId: '30000000-0000-4000-8000-000000000001',
    creatorId: '10000000-0000-4000-8000-000000000001',
    currency: 'USD',
    requestedAmountMinor: 500,
    encryptedDetails: encryptedV2,
    requestedAt: now,
  });

  expect(query).toHaveBeenCalledTimes(2);
  for (const [, params] of query.mock.calls as [string, readonly unknown[]][]) {
    expect(params).toContain('v2');
    expect(params).toContain(encryptedV2.ciphertext);
    expect(JSON.stringify(params)).not.toContain('creator@example.com');
  }
});
