export type OpsIssueRecord = {
  issueId: string;
  issueCode: string;
  status: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  amountMinor: number;
  currency: string;
  designJobId: string | null;
  designState: string | null;
  artworkUrl: string | null;
  artworkWidth: number | null;
  artworkHeight: number | null;
  manufacturingJobId: string | null;
  manufacturingState: string | null;
  providerOrderId: string | null;
  trackingNumber: string | null;
  updatedAt: Date;
};

export interface OpsRepository {
  listRecent(limit: number): Promise<readonly OpsIssueRecord[]>;
  findById(issueId: string): Promise<OpsIssueRecord | null>;
}
