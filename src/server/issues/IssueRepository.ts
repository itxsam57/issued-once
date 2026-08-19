export type IssueObjectType = 'tee' | 'hoodie' | 'hat' | 'tote';

export type IssueStatus =
  | 'RECEIVED'
  | 'BEING_INTERPRETED'
  | 'DESIGN_REVIEW'
  | 'DESIGN_APPROVED'
  | 'MANUFACTURING_DRAFT'
  | 'IN_PRODUCTION'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'CANCELED';

export type PaidIssueTruth = {
  paymentAttemptId: string;
  experienceId: string;
  contactId: string;
  shippingSnapshotId: string;
  quoteId: string;
  productSlug: string;
  variantId: string;
  objectType: IssueObjectType;
  sizeCode: string;
  colorCode: string;
  amountMinor: number;
  currency: string;
  providerReference: string;
};

export type IssueRecord = {
  id: string;
  issueCode: string;
  status: IssueStatus;
  paymentAttemptId: string;
  experienceId: string;
  contactId: string;
  shippingSnapshotId: string;
  quoteId: string;
  productSlug: string;
  variantId: string;
  objectType: IssueObjectType;
  sizeCode: string;
  colorCode: string;
  amountMinor: number;
  currency: string;
  provider: 'SAFEPAY';
  providerReference: string;
  reservedAt: Date;
  updatedAt: Date;
};

export type ReserveIssueInput = {
  issueId: string;
  issueCode: string;
  truth: PaidIssueTruth;
  now: Date;
};

export type ReserveIssueResult =
  | { kind: 'reserved'; issue: IssueRecord }
  | { kind: 'duplicate'; issue: IssueRecord }
  | { kind: 'collision' };

export interface IssueRepository {
  loadPaidTruth(paymentAttemptId: string): Promise<PaidIssueTruth | null>;
  findByPaymentAttemptId(paymentAttemptId: string): Promise<IssueRecord | null>;
  reserve(input: ReserveIssueInput): Promise<ReserveIssueResult>;
  flagPaymentException(input: {
    paymentAttemptId: string;
    reason: 'PAYMENT_REFUNDED' | 'PAYMENT_EXCEPTION';
    updatedAt: Date;
  }): Promise<{ issueId: string } | null>;
}
