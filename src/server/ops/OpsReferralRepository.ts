import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { ReferralRules } from '@/server/referrals/ReferralPolicy';

export type OpsReferralBalance = {
  currency: string;
  pendingMinor: number;
  availableMinor: number;
  paidOutMinor: number;
  reversedMinor: number;
};

export type OpsReferralCreatorRecord = {
  creatorId: string;
  displayName: string;
  normalizedCode: string;
  active: boolean;
  ruleVersionId: string;
  ruleVersion: number;
  rules: ReferralRules;
  salesCount: number;
  balances: OpsReferralBalance[];
};

export type CreateOpsReferralCreatorInput = {
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

export type UpdateOpsReferralCreatorInput = {
  creatorId: string;
  ruleVersionId: string;
  displayName: string;
  code: string;
  rules: ReferralRules;
  now: Date;
};

export type CreateOpsReferralCreatorResult = {
  creatorId: string;
  ruleVersionId: string;
};

export type UpdateOpsReferralCreatorResult = CreateOpsReferralCreatorResult & {
  ruleVersion: number;
};

export type CreateReferralPayoutFromAvailableInput = {
  payoutId: string;
  creatorId: string;
  currency: string;
  encryptedDetails: EncryptedPayload;
  requestedAt: Date;
};

export type ReferralPayoutRequestRecord = {
  payoutId: string;
  creatorId: string;
  currency: string;
  requestedAmountMinor: number;
  conversionCount: number;
  status: 'REQUESTED';
};

export type ReferralPayoutEncryptedDetailsRecord = {
  payoutId: string;
  creatorId: string;
  status: 'REQUESTED' | 'PAID' | 'CANCELLED';
  encryptedDetails: EncryptedPayload;
};

export type ReferralPayoutSettlementRecord = {
  payoutId: string;
  creatorId: string;
  currency: string;
  paidAmountMinor: number;
  conversionCount: number;
  status: 'PAID';
};

export type OpsReferralPayoutSummary = {
  payoutId: string;
  creatorId: string;
  currency: string;
  requestedAmountMinor: number;
  conversionCount: number;
  status: 'REQUESTED' | 'PAID' | 'CANCELLED';
  requestedAt: Date;
  paidAt: Date | null;
};

export interface OpsReferralRepository {
  listCreators(): Promise<OpsReferralCreatorRecord[]>;
  listPayouts(limit?: number): Promise<OpsReferralPayoutSummary[]>;
  createCreator(input: CreateOpsReferralCreatorInput): Promise<CreateOpsReferralCreatorResult>;
  updateCreator(input: UpdateOpsReferralCreatorInput): Promise<UpdateOpsReferralCreatorResult>;
  setCreatorActive(creatorId: string, active: boolean, at: Date): Promise<boolean>;
  createPayoutFromAvailable(input: CreateReferralPayoutFromAvailableInput): Promise<ReferralPayoutRequestRecord>;
  getPayoutEncryptedDetails(payoutId: string): Promise<ReferralPayoutEncryptedDetailsRecord | null>;
  settlePayout(payoutId: string, at: Date): Promise<ReferralPayoutSettlementRecord>;
}
