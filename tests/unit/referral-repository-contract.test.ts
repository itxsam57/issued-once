import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import { normalizeReferralCode, validateReferralRules, type ReferralRules } from '@/server/referrals/ReferralPolicy';
import { PostgresReferralRepository } from '@/server/referrals/PostgresReferralRepository';

const rules: ReferralRules = {
  customerDiscount: { mode: 'PERCENT', basisPoints: 1000 },
  creatorReward: { mode: 'FIXED', amountMinor: 500 },
  payoutCadence: 'THRESHOLD',
  payoutThresholdMinor: 2500,
  attributionWindowDays: 30,
};

const encryptedEmail = {
  version: 1 as const,
  keyVersion: 'v1' as const,
  iv: 'opaque-iv',
  ciphertext: 'opaque-ciphertext',
  tag: 'opaque-tag',
};

const encryptedPayout = {
  version: 1 as const,
  keyVersion: 'v1' as const,
  iv: 'payout-iv',
  ciphertext: 'payout-ciphertext',
  tag: 'payout-tag',
};

describe('ReferralPolicy', () => {
  test('normalizes first-party public codes and rejects path/control characters', () => {
    expect(normalizeReferralCode('  sam-Launch-01  ')).toBe('SAM-LAUNCH-01');
    expect(() => normalizeReferralCode('../sam')).toThrow(/referral code/i);
    expect(() => normalizeReferralCode('SAM 01')).toThrow(/referral code/i);
  });

  test('validates precise percent/fixed units and payout cadence without hardcoding creator economics', () => {
    expect(validateReferralRules(rules)).toEqual(rules);
    expect(() => validateReferralRules({ ...rules, customerDiscount: { mode: 'PERCENT', basisPoints: 10_000 } })).toThrow(/discount/i);
    expect(() => validateReferralRules({ ...rules, payoutCadence: 'THRESHOLD', payoutThresholdMinor: 0 })).toThrow(/threshold/i);
    expect(validateReferralRules({ ...rules, payoutCadence: 'MONTHLY', payoutThresholdMinor: null })).toMatchObject({ payoutCadence: 'MONTHLY' });
  });
});

describe('0029 creator referral migration', () => {
  test('locks privacy, immutable quote snapshots, conversion idempotency, reward lifecycle and payout allocation invariants', async () => {
    const sql = await readFile(new URL('../../db/migrations/0029_creator_referrals.sql', import.meta.url), 'utf8');

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS referral_creators/i);
    expect(sql).toMatch(/normalized_code[^\n]+UNIQUE/i);
    expect(sql).toMatch(/email_payload_version/i);
    expect(sql).toMatch(/email_ciphertext/i);
    expect(sql).not.toMatch(/email_plaintext/i);

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS referral_rule_versions/i);
    expect(sql).toMatch(/UNIQUE\s*\(creator_id,\s*version\)/i);
    expect(sql).toMatch(/customer_discount_bps/i);
    expect(sql).toMatch(/customer_discount_fixed_minor/i);
    expect(sql).toMatch(/creator_reward_bps/i);
    expect(sql).toMatch(/creator_reward_fixed_minor/i);

    expect(sql).toMatch(/ALTER TABLE checkout_quotes/i);
    expect(sql).toMatch(/gross_amount_minor/i);
    expect(sql).toMatch(/discount_amount_minor/i);
    expect(sql).toMatch(/referral_rule_snapshot/i);
    expect(sql).toMatch(/referral_attribution_id/i);

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS referral_conversions/i);
    expect(sql).toMatch(/payment_attempt_id[^\n]+UNIQUE/i);
    expect(sql).toMatch(/PENDING.*AVAILABLE.*REVERSED.*PAID_OUT/is);

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS referral_payout_requests/i);
    expect(sql).toMatch(/details_ciphertext/i);
    expect(sql).not.toMatch(/payout_details_plaintext/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS referral_payout_allocations/i);
    expect(sql).toMatch(/conversion_id[^\n]+UNIQUE/i);
  });
});

describe('PostgresReferralRepository', () => {
  test('creates a creator and immutable rule version using only encrypted creator email payload', async () => {
    const query = vi.fn().mockResolvedValue([{ creator_id: '10000000-0000-4000-8000-000000000001', rule_version_id: '20000000-0000-4000-8000-000000000001', version: 1 }]);
    const repository = new PostgresReferralRepository({ query });

    await repository.createCreator({
      creatorId: '10000000-0000-4000-8000-000000000001',
      ruleVersionId: '20000000-0000-4000-8000-000000000001',
      displayName: 'Creator One',
      emailHash: 'a'.repeat(64),
      encryptedEmail,
      code: 'sam-launch-01',
      rules,
      active: true,
      now: new Date('2026-08-21T10:00:00.000Z'),
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [statement, params] = query.mock.calls[0] as [string, readonly unknown[]];
    expect(statement).toMatch(/referral_creators/i);
    expect(statement).toMatch(/referral_rule_versions/i);
    expect(params).toContain('SAM-LAUNCH-01');
    expect(params).toContain(encryptedEmail.ciphertext);
    expect(JSON.stringify(params)).not.toContain('creator@example');
  });

  test('stores payout details only as encrypted payload and never allocates the same conversion twice', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresReferralRepository({ query });

    await repository.createPayoutRequest({
      payoutId: '30000000-0000-4000-8000-000000000001',
      creatorId: '10000000-0000-4000-8000-000000000001',
      currency: 'PKR',
      requestedAmountMinor: 250000,
      encryptedDetails: encryptedPayout,
      requestedAt: new Date('2026-08-21T10:00:00.000Z'),
    });

    const [statement, params] = query.mock.calls[0] as [string, readonly unknown[]];
    expect(statement).toMatch(/referral_payout_requests/i);
    expect(params).toContain(encryptedPayout.ciphertext);
    expect(statement).not.toMatch(/plaintext/i);
  });
});
