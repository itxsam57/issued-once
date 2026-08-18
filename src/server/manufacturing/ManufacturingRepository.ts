import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { IssueStatus } from '@/server/issues/IssueRepository';
import type { DesignJobState } from '@/server/design/DesignRepository';

export type ManufacturingInput = {
  issueId: string;
  issueCode: string;
  issueStatus: IssueStatus;
  designJobId: string;
  designState: DesignJobState;
  artworkUrl: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  encryptedEmail: EncryptedPayload;
  encryptedAddress: EncryptedPayload;
};

export type ManufacturingJobState =
  | 'RESERVED'
  | 'DRAFT'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELED';

export type ManufacturingJobRecord = {
  id: string;
  issueId: string;
  designJobId: string;
  state: ManufacturingJobState;
  provider: 'PRINTFUL';
  providerOrderId: string | null;
  providerStatus: string | null;
  printfulVariantId: number | null;
  artworkUrl: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
};

export interface ManufacturingRepository {
  loadInput(issueId: string): Promise<ManufacturingInput | null>;
  findByIssueId(issueId: string): Promise<ManufacturingJobRecord | null>;
  reserve(job: ManufacturingJobRecord): Promise<{ created: boolean; job: ManufacturingJobRecord }>;
  attachDraft(input: {
    jobId: string;
    providerOrderId: string;
    providerStatus: string;
    printfulVariantId: number;
    updatedAt: Date;
  }): Promise<ManufacturingJobRecord>;
  markConfirmed(input: {
    jobId: string;
    confirmedAt: Date;
  }): Promise<ManufacturingJobRecord>;
  markFailed(jobId: string, code: string, updatedAt: Date): Promise<void>;
}
