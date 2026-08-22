import type { IssueStatus } from './IssueRepository';

export type CustomerIssueStatus = {
  issueCode: string;
  internalStatus: IssueStatus;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  trackingUrl: string | null;
  trackingNumber: string | null;
  updatedAt: Date;
};

export interface IssueStatusRepository {
  findBySessionHash(sessionHash: string): Promise<CustomerIssueStatus | null>;
  findByIssueCode(issueCode: string): Promise<CustomerIssueStatus | null>;
}
