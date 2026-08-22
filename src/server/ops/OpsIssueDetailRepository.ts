export type OpsIssueFilters = {
  issueStatus?: string | null;
  paymentStatus?: string | null;
  designState?: string | null;
  manufacturingState?: string | null;
  objectType?: string | null;
  supportOpen?: boolean | null;
  paymentException?: boolean | null;
  countryCode?: string | null;
  updatedFrom?: Date | null;
  updatedTo?: Date | null;
};

export type OpsIssueListItem = {
  issueId: string;
  issueCode: string;
  status: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  amountMinor: number;
  currency: string;
  paymentStatus: string | null;
  designState: string | null;
  manufacturingState: string | null;
  providerOrderId: string | null;
  trackingNumber: string | null;
  paymentExceptionCode: string | null;
  updatedAt: Date;
};

export type OpsIssueDetail = OpsIssueListItem & {
  paymentProvider: string | null;
  paymentProviderReference: string | null;
  designJobId: string | null;
  artworkWidth: number | null;
  artworkHeight: number | null;
  designProvider: string | null;
  designModel: string | null;
  manufacturingJobId: string | null;
  providerStatus: string | null;
  trackingUrl: string | null;
  reservedAt: Date;
  privacy: {
    verifiedEmail: boolean;
    shipping: boolean;
    answers: boolean;
    privateBrief: boolean;
    supportMessage: boolean;
  };
  timeline: Array<{ eventType: string; source: string; safeDetail: Record<string, unknown> | null; createdAt: Date }>;
  notifications: Array<{ eventKey: string; status: string; attemptCount: number; updatedAt: Date }>;
  support: Array<{ requestId: string; status: string; createdAt: Date; updatedAt: Date }>;
};

export interface OpsIssueDetailRepository {
  listIssues(input: {
    cursor?: string | null;
    limit: number;
    search?: string | null;
    filters: OpsIssueFilters;
  }): Promise<{ items: OpsIssueListItem[]; nextCursor: string | null }>;
  getIssueDetail(issueId: string): Promise<OpsIssueDetail | null>;
}
