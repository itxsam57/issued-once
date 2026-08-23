import type { EncryptedPayload } from '@/server/crypto/privatePayload';

export type NotificationEventKey =
  | 'PAYMENT_RECEIVED'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED';

export type NotificationInput = {
  issueId: string;
  issueCode: string;
  publicStatus: string;
  encryptedEmail: EncryptedPayload;
  trackingUrl: string | null;
  trackingNumber: string | null;
};

export interface NotificationRepository {
  loadInput(issueId: string): Promise<NotificationInput | null>;
  reserve(issueId: string, eventKey: NotificationEventKey, at: Date): Promise<boolean>;
  markSent(issueId: string, eventKey: NotificationEventKey, providerMessageId: string, at: Date): Promise<void>;
  markFailed(issueId: string, eventKey: NotificationEventKey, code: string, at: Date): Promise<void>;
}
