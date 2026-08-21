import type { EncryptedPayload } from '@/server/crypto/privatePayload';

export type ReferralNotificationKind = 'SALE' | 'REVERSAL';

export type ReferralNotificationInput = {
  conversionId: string;
  creatorId: string;
  encryptedEmail: EncryptedPayload;
  rewardAmountMinor: number;
  currency: string;
  pendingBalanceMinor: number;
  availableBalanceMinor: number;
};

export interface ReferralNotificationRepository {
  loadNotificationInput(conversionId: string): Promise<ReferralNotificationInput | null>;
  reserveNotification(input: {
    id: string;
    conversionId: string;
    kind: ReferralNotificationKind;
    now: Date;
  }): Promise<boolean>;
  markNotificationSent(
    conversionId: string,
    kind: ReferralNotificationKind,
    providerMessageId: string,
    now: Date,
  ): Promise<void>;
  markNotificationFailed(
    conversionId: string,
    kind: ReferralNotificationKind,
    errorCode: string,
    now: Date,
  ): Promise<void>;
}
