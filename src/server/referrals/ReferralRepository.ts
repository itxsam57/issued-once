import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { ReferralRules } from './ReferralPolicy';

export type CreateReferralCreatorInput = {
  creatorId: string;
  ruleVersionId: string;
  displayName: string;
  emailHash: string;
  encryptedEmail: EncryptedPayload;
  code: string;
  rules: ReferralRules;
  active: boolean;
  now: Date;
};

export type CreateReferralPayoutRequestInput = {
  payoutId: string;
  creatorId: string;
  currency: string;
  requestedAmountMinor: number;
  encryptedDetails: EncryptedPayload;
  requestedAt: Date;
};

export type ActiveReferralRuleRecord = {
  creatorId: string;
  creatorEmailHash: string;
  ruleVersionId: string;
  normalizedCode: string;
  active: boolean;
  rules: ReferralRules;
};

export type ReferralAttributionRecord = ActiveReferralRuleRecord & {
  id: string;
  source: 'LINK' | 'CODE';
  createdAt: Date;
  expiresAt: Date;
};

export type CreateReferralAttributionInput = {
  id: string;
  creatorId: string;
  ruleVersionId: string;
  source: 'LINK' | 'CODE';
  createdAt: Date;
  expiresAt: Date;
};

export interface ReferralRepository {
  createCreator(input: CreateReferralCreatorInput): Promise<void>;
  createPayoutRequest(input: CreateReferralPayoutRequestInput): Promise<void>;
  findActiveRuleByCode(code: string): Promise<ActiveReferralRuleRecord | null>;
  createAttribution(input: CreateReferralAttributionInput): Promise<void>;
  findAttribution(id: string): Promise<ReferralAttributionRecord | null>;
}
