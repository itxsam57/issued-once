import { createHash, randomUUID } from 'node:crypto';
import {
  decryptPrivatePayload,
  encryptPrivatePayload,
  type EncryptedPayload,
} from '@/server/crypto/privatePayload';
import {
  normalizeReferralCode,
  validateReferralRules,
  type ReferralRules,
} from '@/server/referrals/ReferralPolicy';
import type { OpsAuditService } from './OpsAuditService';
import type {
  OpsReferralCreatorRecord,
  OpsReferralPayoutSummary,
  OpsReferralRepository,
} from './OpsReferralRepository';

type AuditWriter = Pick<OpsAuditService, 'record'>;
type IdKind = 'creator' | 'rule' | 'payout';
type Dependencies = {
  repository: OpsReferralRepository;
  audit: AuditWriter;
  encrypt?: (value: unknown) => Promise<EncryptedPayload>;
  decrypt?: <T>(payload: EncryptedPayload) => Promise<T>;
  hashEmail?: (normalizedEmail: string) => string;
  now?: () => Date;
  createId?: (kind: IdKind) => string;
};

export type SafeOpsReferralBalance = {
  currency: string;
  pendingMinor: number;
  availableMinor: number;
  paidOutMinor: number;
  reversedMinor: number;
  payoutReady: boolean;
};

export type SafeOpsReferralCreator = {
  creatorId: string;
  displayName: string;
  code: string;
  referralPath: string;
  active: boolean;
  ruleVersionId: string;
  ruleVersion: number;
  rules: ReferralRules;
  salesCount: number;
  balances: SafeOpsReferralBalance[];
};

function normalizedEmail(input: string): string {
  const value = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 320) {
    throw new Error('Creator email is invalid');
  }
  return value;
}

function normalizedName(input: string): string {
  const value = input.trim();
  if (!value || value.length > 120) throw new Error('Creator display name is invalid');
  return value;
}

function normalizedCurrency(input: string): string {
  const value = input.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) throw new Error('Payout currency is invalid');
  return value;
}

function reason(input: string): string {
  const value = input.trim();
  if (value.length < 3) throw new Error('A reason is required');
  if (value.length > 500) throw new Error('Reason is too long');
  return value;
}

function safeDetails(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Payout details are required');
  }
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) throw new Error('Payout details are required');
  const serialized = JSON.stringify(input);
  if (serialized.length > 10_000) throw new Error('Payout details are too large');
  return input as Record<string, unknown>;
}

function payoutReady(record: OpsReferralCreatorRecord, availableMinor: number): boolean {
  if (availableMinor <= 0) return false;
  if (record.rules.payoutCadence === 'MONTHLY') return true;
  return availableMinor >= (record.rules.payoutThresholdMinor ?? Number.MAX_SAFE_INTEGER);
}

export class OpsReferralService {
  private readonly encrypt: (value: unknown) => Promise<EncryptedPayload>;
  private readonly decrypt: <T>(payload: EncryptedPayload) => Promise<T>;
  private readonly hashEmail: (normalizedEmail: string) => string;
  private readonly now: () => Date;
  private readonly createId: (kind: IdKind) => string;

  constructor(private readonly dependencies: Dependencies) {
    this.encrypt = dependencies.encrypt ?? encryptPrivatePayload;
    this.decrypt = dependencies.decrypt ?? decryptPrivatePayload;
    this.hashEmail = dependencies.hashEmail ?? ((value) => createHash('sha256').update(value, 'utf8').digest('hex'));
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? (() => randomUUID());
  }

  async listCreators(): Promise<SafeOpsReferralCreator[]> {
    const creators = await this.dependencies.repository.listCreators();
    return creators.map((creator) => ({
      creatorId: creator.creatorId,
      displayName: creator.displayName,
      code: creator.normalizedCode,
      referralPath: `/r/${creator.normalizedCode}`,
      active: creator.active,
      ruleVersionId: creator.ruleVersionId,
      ruleVersion: creator.ruleVersion,
      rules: creator.rules,
      salesCount: creator.salesCount,
      balances: creator.balances.map((balance) => ({
        ...balance,
        payoutReady: payoutReady(creator, balance.availableMinor),
      })),
    }));
  }

  async listPayouts(limit?: number): Promise<OpsReferralPayoutSummary[]> {
    return this.dependencies.repository.listPayouts(limit);
  }

  async createCreator(input: {
    displayName: string;
    email: string;
    code: string;
    rules: ReferralRules;
  }) {
    const displayName = normalizedName(input.displayName);
    const email = normalizedEmail(input.email);
    const code = normalizeReferralCode(input.code);
    const rules = validateReferralRules(input.rules);
    const creatorId = this.createId('creator');
    const ruleVersionId = this.createId('rule');
    const now = this.now();
    const encryptedEmail = await this.encrypt({ email });
    const result = await this.dependencies.repository.createCreator({
      creatorId,
      ruleVersionId,
      displayName,
      emailHash: this.hashEmail(email),
      encryptedEmail,
      code,
      rules,
      active: true,
      now,
    });
    await this.dependencies.audit.record({
      actor: 'OWNER',
      action: 'OPS_REFERRAL_CREATOR_CREATED',
      issueId: null,
      targetType: 'referral_creator',
      targetId: result.creatorId,
      reason: null,
      safeMetadata: { code, active: true, ruleVersion: 1 },
    });
    return result;
  }

  async updateCreator(creatorIdInput: string, input: {
    displayName: string;
    code: string;
    rules: ReferralRules;
  }) {
    const creatorId = creatorIdInput.trim();
    if (!creatorId) throw new Error('Creator is required');
    const displayName = normalizedName(input.displayName);
    const code = normalizeReferralCode(input.code);
    const rules = validateReferralRules(input.rules);
    const result = await this.dependencies.repository.updateCreator({
      creatorId,
      ruleVersionId: this.createId('rule'),
      displayName,
      code,
      rules,
      now: this.now(),
    });
    await this.dependencies.audit.record({
      actor: 'OWNER',
      action: 'OPS_REFERRAL_RULE_VERSION_CREATED',
      issueId: null,
      targetType: 'referral_creator',
      targetId: creatorId,
      reason: null,
      safeMetadata: { code, ruleVersion: result.ruleVersion },
    });
    return result;
  }

  async setCreatorActive(creatorIdInput: string, active: boolean) {
    const creatorId = creatorIdInput.trim();
    if (!creatorId) throw new Error('Creator is required');
    const changed = await this.dependencies.repository.setCreatorActive(creatorId, active, this.now());
    if (!changed) throw new Error('Creator was not found');
    await this.dependencies.audit.record({
      actor: 'OWNER',
      action: active ? 'OPS_REFERRAL_CREATOR_RESUMED' : 'OPS_REFERRAL_CREATOR_PAUSED',
      issueId: null,
      targetType: 'referral_creator',
      targetId: creatorId,
      reason: null,
      safeMetadata: { active },
    });
    return { creatorId, active };
  }

  async requestPayout(input: {
    creatorId: string;
    currency: string;
    details: unknown;
    reason: string;
  }) {
    const creatorId = input.creatorId.trim();
    if (!creatorId) throw new Error('Creator is required');
    const payoutCurrency = normalizedCurrency(input.currency);
    const requestReason = reason(input.reason);
    const details = safeDetails(input.details);
    const payoutId = this.createId('payout');
    const encryptedDetails = await this.encrypt(details);
    const result = await this.dependencies.repository.createPayoutFromAvailable({
      payoutId,
      creatorId,
      currency: payoutCurrency,
      encryptedDetails,
      requestedAt: this.now(),
    });
    await this.dependencies.audit.record({
      actor: 'OWNER',
      action: 'OPS_REFERRAL_PAYOUT_REQUEST',
      issueId: null,
      targetType: 'referral_payout',
      targetId: result.payoutId,
      reason: requestReason,
      safeMetadata: {
        creatorId: result.creatorId,
        currency: result.currency,
        requestedAmountMinor: result.requestedAmountMinor,
        conversionCount: result.conversionCount,
      },
    });
    return result;
  }

  async revealPayoutDetails(input: { payoutId: string; reason: string }): Promise<unknown> {
    const payoutId = input.payoutId.trim();
    if (!payoutId) throw new Error('Payout is required');
    const revealReason = reason(input.reason);
    const record = await this.dependencies.repository.getPayoutEncryptedDetails(payoutId);
    if (!record) throw new Error('Payout was not found');
    const value = await this.decrypt<unknown>(record.encryptedDetails);
    await this.dependencies.audit.record({
      actor: 'OWNER',
      action: 'OPS_REFERRAL_PAYOUT_REVEAL',
      issueId: null,
      targetType: 'referral_payout',
      targetId: record.payoutId,
      reason: revealReason,
      safeMetadata: { creatorId: record.creatorId, status: record.status },
    });
    return value;
  }

  async markPayoutPaid(input: { payoutId: string; reason: string }) {
    const payoutId = input.payoutId.trim();
    if (!payoutId) throw new Error('Payout is required');
    const settlementReason = reason(input.reason);
    const result = await this.dependencies.repository.settlePayout(payoutId, this.now());
    await this.dependencies.audit.record({
      actor: 'OWNER',
      action: 'OPS_REFERRAL_PAYOUT_PAID',
      issueId: null,
      targetType: 'referral_payout',
      targetId: result.payoutId,
      reason: settlementReason,
      safeMetadata: {
        creatorId: result.creatorId,
        currency: result.currency,
        paidAmountMinor: result.paidAmountMinor,
        conversionCount: result.conversionCount,
      },
    });
    return result;
  }
}
