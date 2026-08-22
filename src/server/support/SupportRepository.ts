import type { EncryptedPayload } from '@/server/crypto/privatePayload';

export type SupportContext = {
  issueId: string;
  issueCode: string;
  contactId: string;
  encryptedEmail: EncryptedPayload;
};

export type SupportRequestRecord = {
  id: string;
  issueId: string;
  contactId: string;
  encryptedMessage: EncryptedPayload;
  createdAt: Date;
  updatedAt: Date;
};

export interface SupportRepository {
  findContextBySessionHash(sessionHash: string): Promise<SupportContext | null>;
  create(record: SupportRequestRecord): Promise<void>;
}
