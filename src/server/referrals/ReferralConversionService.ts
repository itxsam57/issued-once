import { randomUUID } from 'node:crypto';
import type {
  PaidReferralTruth,
  ReferralRepository,
} from './ReferralRepository';
import type { ReferralRules } from './ReferralPolicy';
import {
  normalizeReferralCode,
  validateReferralRules,
} from './ReferralPolicy';

type ConversionRepository = Pick<
  ReferralRepository,
  'loadPaidReferralTruth' | 'createConversion'
>;

type Dependencies = {
  repository: ConversionRepository;
  now?: () => Date;
  createConversionId?: () => string;
};

type FrozenRuleSnapshot = {
  code: string;
  rules: ReferralRules;
};

export type ReferralPaidConversionOutcome =
  | { kind: 'not-referred' }
  | {
      kind: 'created' | 'duplicate';
      conversionId: string;
      creatorId: string;
      rewardAmountMinor: number;
      currency: string;
    };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Referral rule snapshot is invalid');
  }
  return value as Record<string, unknown>;
}

function parseRuleSnapshot(value: unknown): FrozenRuleSnapshot {
  const snapshot = asRecord(value);
  if (typeof snapshot.code !== 'string') throw new Error('Referral rule snapshot code is invalid');
  const normalizedCode = normalizeReferralCode(snapshot.code);
  const rules = validateReferralRules(asRecord(snapshot.rules) as ReferralRules);
  return { code: normalizedCode, rules };
}

function discountFromRules(grossAmountMinor: number, rules: ReferralRules): number {
  return rules.customerDiscount.mode === 'PERCENT'
    ? Math.floor((grossAmountMinor * rules.customerDiscount.basisPoints) / 10_000)
    : rules.customerDiscount.amountMinor;
}

function rewardFromRules(paidAmountMinor: number, rules: ReferralRules): number {
  const reward = rules.creatorReward.mode === 'PERCENT'
    ? Math.floor((paidAmountMinor * rules.creatorReward.basisPoints) / 10_000)
    : rules.creatorReward.amountMinor;
  if (!Number.isSafeInteger(reward) || reward <= 0) {
    throw new Error('Referral reward must resolve to a positive minor-unit amount');
  }
  return reward;
}

function validatePaidTruth(truth: PaidReferralTruth): FrozenRuleSnapshot {
  if (!truth.paymentAttemptId || !truth.creatorId || !truth.ruleVersionId) {
    throw new Error('Paid referral truth is incomplete');
  }
  if (!/^[A-Z]{3}$/.test(truth.currency)) throw new Error('Paid referral currency is invalid');

  for (const [label, value] of [
    ['gross', truth.grossAmountMinor],
    ['discount', truth.discountAmountMinor],
    ['paid', truth.paidAmountMinor],
  ] as const) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Paid referral ${label} amount is invalid`);
    }
  }
  if (truth.grossAmountMinor - truth.discountAmountMinor !== truth.paidAmountMinor) {
    throw new Error('Paid referral amount snapshot is inconsistent');
  }

  const snapshot = parseRuleSnapshot(truth.ruleSnapshot);
  if (discountFromRules(truth.grossAmountMinor, snapshot.rules) !== truth.discountAmountMinor) {
    throw new Error('Paid referral discount does not match the frozen rule snapshot');
  }
  return snapshot;
}

export class ReferralConversionService {
  private readonly now: () => Date;
  private readonly createConversionId: () => string;

  constructor(private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createConversionId = dependencies.createConversionId ?? (() => randomUUID());
  }

  async recordPaidAttempt(input: {
    paymentAttemptId: string;
    issueId: string;
  }): Promise<ReferralPaidConversionOutcome> {
    const paymentAttemptId = input.paymentAttemptId.trim();
    const issueId = input.issueId.trim();
    if (!paymentAttemptId) throw new Error('Payment attempt is required for referral conversion');
    if (!issueId) throw new Error('Issue is required for referral conversion');

    const truth = await this.dependencies.repository.loadPaidReferralTruth(paymentAttemptId);
    if (!truth) return { kind: 'not-referred' };
    if (truth.paymentAttemptId !== paymentAttemptId) {
      throw new Error('Paid referral truth does not match the requested payment attempt');
    }

    const snapshot = validatePaidTruth(truth);
    const rewardAmountMinor = rewardFromRules(truth.paidAmountMinor, snapshot.rules);
    const convertedAt = this.now();
    const result = await this.dependencies.repository.createConversion({
      id: this.createConversionId(),
      creatorId: truth.creatorId,
      ruleVersionId: truth.ruleVersionId,
      paymentAttemptId,
      issueId,
      grossAmountMinor: truth.grossAmountMinor,
      discountAmountMinor: truth.discountAmountMinor,
      paidAmountMinor: truth.paidAmountMinor,
      rewardAmountMinor,
      currency: truth.currency,
      ruleSnapshot: snapshot,
      state: 'PENDING',
      convertedAt,
      updatedAt: convertedAt,
    });

    return {
      kind: result.kind,
      conversionId: result.conversion.id,
      creatorId: result.conversion.creatorId,
      rewardAmountMinor: result.conversion.rewardAmountMinor,
      currency: result.conversion.currency,
    };
  }
}
