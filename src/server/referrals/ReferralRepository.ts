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

export interface ReferralRepository {
  createCreator(input: CreateReferralCreatorInput): Promise<void>;
  createPayoutRequest(input: CreateReferralPayoutRequestInput): Promise<void>;
}
