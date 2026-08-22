import type { EncryptedPayload } from '@/server/crypto/privatePayload';

export type ShippingAddress = {
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
};

export type ShippingSnapshotRecord = {
  id: string;
  experienceId: string;
  contactId: string;
  countryCode: string;
  encryptedAddress: EncryptedPayload;
  createdAt: Date;
  updatedAt: Date;
};

export interface ShippingRepository {
  upsert(record: ShippingSnapshotRecord): Promise<ShippingSnapshotRecord>;
  findByExperienceId(experienceId: string): Promise<ShippingSnapshotRecord | null>;
}
