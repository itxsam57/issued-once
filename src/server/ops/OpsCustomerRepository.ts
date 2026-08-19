export type OpsCustomerRecord = {
  emailHash: string;
  contactAlias: string;
  issueCount: number;
  paidMinor: number;
  refundedIssues: number;
  activeDeliveries: number;
  supportCount: number;
  lastSeenAt: Date;
};

export interface OpsCustomerRepository {
  listCustomers(input: { limit: number; cursor?: string | null; emailHash?: string | null }): Promise<{ items: OpsCustomerRecord[]; nextCursor: string | null }>;
}
