export type OpsAuditScalar = string | number | boolean | null;

export type OpsAuditInput = {
  actor: 'OWNER';
  action: string;
  issueId: string | null;
  targetType: string;
  targetId: string;
  reason: string | null;
  safeMetadata: Record<string, OpsAuditScalar>;
};

export type OpsAuditRecord = OpsAuditInput & {
  id: string;
  createdAt: Date;
};

export type OpsAuditPage = {
  items: OpsAuditRecord[];
  nextCursor: string | null;
};

export type OpsAuditListInput = {
  cursor?: string | null;
  limit: number;
  action?: string | null;
  issueCode?: string | null;
  target?: string | null;
  from?: Date | null;
  to?: Date | null;
};

export interface OpsAuditRepository {
  append(input: OpsAuditInput): Promise<void>;
  listRecent(input: OpsAuditListInput): Promise<OpsAuditPage>;
}
