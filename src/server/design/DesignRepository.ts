import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { IssueStatus } from '@/server/issues/IssueRepository';

export type DesignQuestionRecord = {
  slot: 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7';
  questionId: string;
  questionVersion: number;
  family: string;
  prompt: string;
  encryptedAnswer: EncryptedPayload;
};

export type DesignInput = {
  issueId: string;
  issueCode: string;
  issueStatus: IssueStatus;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  questions: readonly DesignQuestionRecord[];
};

export type DesignJobState =
  | 'QUEUED'
  | 'INTERPRETING'
  | 'GENERATING'
  | 'REVIEW'
  | 'APPROVED'
  | 'FAILED';

export type DesignJobRecord = {
  id: string;
  issueId: string;
  state: DesignJobState;
  encryptedBrief: EncryptedPayload | null;
  artworkUrl: string | null;
  artworkMimeType: string | null;
  artworkBytes: number | null;
  width: number | null;
  height: number | null;
  provider: string | null;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface DesignRepository {
  loadInput(issueId: string): Promise<DesignInput | null>;
  findByIssueId(issueId: string): Promise<DesignJobRecord | null>;
  begin(job: DesignJobRecord): Promise<{ created: boolean; job: DesignJobRecord }>;
  saveGenerated(input: {
    jobId: string;
    encryptedBrief: EncryptedPayload;
    artworkUrl: string;
    artworkMimeType: string;
    artworkBytes: number;
    width: number;
    height: number;
    provider: string;
    model: string;
    updatedAt: Date;
  }): Promise<DesignJobRecord>;
  markFailed(jobId: string, code: string, updatedAt: Date): Promise<void>;
}
