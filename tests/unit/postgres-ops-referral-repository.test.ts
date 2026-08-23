import { expect, test, vi } from 'vitest';
import { PostgresOpsReferralRepository } from '@/server/ops/PostgresOpsReferralRepository';

const encrypted = {
  version: 1 as const,
  keyVersion: 'v1' as const,
  iv: 'iv', ciphertext: 'ciphertext', tag: 'tag',
};
const now = new Date('2026-08-21T13:30:00.000Z');

function executor(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue(rows);
  return { query, repository: new PostgresOpsReferralRepository({ query }) };
}

test('payout request atomically locks and allocates only unallocated AVAILABLE conversions for creator and currency', async () => {
  const { query, repository } = executor([{
    payout_id: 'payout-1', creator_id: 'creator-1', currency: 'USD',
    requested_amount_minor: 2916, conversion_count: 3, status: 'REQUESTED',
  }]);

  await repository.createPayoutFromAvailable({
    payoutId: 'payout-1', creatorId: 'creator-1', currency: 'USD',
    encryptedDetails: encrypted, requestedAt: now,
  });

  expect(query).toHaveBeenCalledTimes(1);
  const [statement, params] = query.mock.calls[0];
  expect(statement).toMatch(/WITH[\s\S]*candidate_conversions/i);
  expect(statement).toMatch(/state\s*=\s*'AVAILABLE'/i);
  expect(statement).toMatch(/creator_id\s*=\s*\$2::uuid/i);
  expect(statement).toMatch(/currency\s*=\s*\$3/i);
  expect(statement).toMatch(/NOT EXISTS[\s\S]*referral_payout_allocations/i);
  expect(statement).toMatch(/FOR UPDATE[\s\S]*SKIP LOCKED/i);
  expect(statement).toMatch(/INSERT INTO referral_payout_requests/i);
  expect(statement).toMatch(/INSERT INTO referral_payout_allocations/i);
  expect(statement).toMatch(/SUM\(reward_amount_minor\)/i);
  expect(params).toEqual(expect.arrayContaining(['payout-1', 'creator-1', 'USD', now]));
});

test('settlement is one atomic statement and cannot mark payout PAID unless every allocated conversion is still AVAILABLE', async () => {
  const { query, repository } = executor([{
    payout_id: 'payout-1', creator_id: 'creator-1', currency: 'USD',
    paid_amount_minor: 2916, conversion_count: 3, status: 'PAID',
  }]);

  await repository.settlePayout('payout-1', now);

  expect(query).toHaveBeenCalledTimes(1);
  const [statement, params] = query.mock.calls[0];
  expect(statement).toMatch(/WITH[\s\S]*locked_request/i);
  expect(statement).toMatch(/FOR UPDATE/i);
  expect(statement).toMatch(/referral_payout_allocations/i);
  expect(statement).toMatch(/state\s*=\s*'AVAILABLE'/i);
  expect(statement).toMatch(/state\s*=\s*'PAID_OUT'/i);
  expect(statement).toMatch(/paid_out_at/i);
  expect(statement).toMatch(/status\s*=\s*'PAID'/i);
  expect(statement).toMatch(/eligible_count[\s\S]*allocated_count/i);
  expect(params).toEqual(['payout-1', now]);
});

test('creator economics edit appends a new immutable rule version rather than updating historical rules', async () => {
  const { query, repository } = executor([{
    creator_id: 'creator-1', rule_version_id: 'rule-3', rule_version: 3,
  }]);
  await repository.updateCreator({
    creatorId: 'creator-1', ruleVersionId: 'rule-3', displayName: 'Creator One', code: 'CREATOR-ONE',
    rules: {
      customerDiscount: { mode: 'PERCENT', basisPoints: 1000 },
      creatorReward: { mode: 'FIXED', amountMinor: 700 },
      payoutCadence: 'THRESHOLD', payoutThresholdMinor: 2500, attributionWindowDays: 30,
    },
    now,
  });

  const [statement] = query.mock.calls[0];
  expect(statement).toMatch(/UPDATE referral_creators/i);
  expect(statement).toMatch(/INSERT INTO referral_rule_versions/i);
  expect(statement).toMatch(/MAX\(version\)[\s\S]*\+\s*1/i);
  expect(statement).not.toMatch(/UPDATE referral_rule_versions/i);
});

test('normal creator list query contains aggregate ledger data but never selects encrypted creator email or payout details', async () => {
  const { query, repository } = executor([]);
  await repository.listCreators();
  const [statement] = query.mock.calls[0];
  expect(statement).toMatch(/referral_creators/i);
  expect(statement).toMatch(/referral_conversions/i);
  expect(statement).not.toMatch(/email_ciphertext|email_iv|email_auth_tag|details_ciphertext|details_iv|details_auth_tag/i);
});
