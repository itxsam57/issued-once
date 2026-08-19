import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

export type OpsAttentionKind =
  | 'PAID_WITHOUT_ISSUE'
  | 'PAYMENT_EXCEPTION'
  | 'FACTORY_MAPPING_MISSING'
  | 'PROVIDER_STATE_MISMATCH'
  | 'DESIGN_FAILED'
  | 'DESIGN_STUCK'
  | 'MANUFACTURING_FAILED'
  | 'NOTIFICATION_FAILED'
  | 'SUPPORT_AGING';
export type OpsAttentionItem = {
  kind: OpsAttentionKind;
  priority: number;
  issueId: string | null;
  issueCode: string | null;
  targetId: string;
  detail: string;
  createdAt: Date;
};

type Row = { kind: OpsAttentionKind; priority: number | string; issue_id: string | null; issue_code: string | null; target_id: string; detail: string; created_at: Date | string };

export class PostgresOpsAttentionRepository {
  constructor(private readonly sql: SqlExecutor, private readonly factoryMappingKeys: readonly string[] = []) {}

  async list(limit: number, now: Date): Promise<OpsAttentionItem[]> {
    const rows = await this.sql.query<Row>(
      `SELECT * FROM (
        SELECT 'PAID_WITHOUT_ISSUE'::text AS kind,100 AS priority,NULL::uuid AS issue_id,NULL::text AS issue_code,
          payment.id AS target_id,'Paid payment requires Issue creation' AS detail,payment.updated_at AS created_at
        FROM payment_attempts payment
        WHERE payment.status='PAID' AND NOT EXISTS (SELECT 1 FROM issues issue WHERE issue.payment_attempt_id=payment.id)
        UNION ALL
        SELECT 'PAYMENT_EXCEPTION',95,issue.id,issue.issue_code,issue.payment_attempt_id,
          COALESCE(issue.payment_exception_code,'PAYMENT_EXCEPTION'),issue.updated_at
        FROM issues issue WHERE issue.payment_exception_code IS NOT NULL
        UNION ALL
        SELECT 'FACTORY_MAPPING_MISSING',90,issue.id,issue.issue_code,issue.id::text,
          concat('No Printful mapping for ',issue.object_type,':',issue.size_code,':',issue.color_code),issue.updated_at
        FROM issues issue
        WHERE issue.status='DESIGN_APPROVED'
          AND NOT (concat(issue.object_type,':',issue.size_code,':',issue.color_code)=ANY($3::text[]))
        UNION ALL
        SELECT 'PROVIDER_STATE_MISMATCH',88,issue.id,issue.issue_code,manufacturing.id::text,
          'Factory state requires a remote provider order ID',manufacturing.updated_at
        FROM manufacturing_jobs manufacturing JOIN issues issue ON issue.id=manufacturing.issue_id
        WHERE manufacturing.state IN ('DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED') AND manufacturing.provider_order_id IS NULL
        UNION ALL
        SELECT 'DESIGN_FAILED',80,issue.id,issue.issue_code,design.id::text,'Design job failed',design.updated_at
        FROM design_jobs design JOIN issues issue ON issue.id=design.issue_id WHERE design.state='FAILED'
        UNION ALL
        SELECT 'DESIGN_STUCK',75,issue.id,issue.issue_code,design.id::text,'Design worker exceeded lease window',design.updated_at
        FROM design_jobs design JOIN issues issue ON issue.id=design.issue_id
        WHERE design.state IN ('INTERPRETING','GENERATING') AND design.updated_at < $2::timestamptz - INTERVAL '15 minutes'
        UNION ALL
        SELECT 'MANUFACTURING_FAILED',85,issue.id,issue.issue_code,manufacturing.id::text,'Manufacturing job failed',manufacturing.updated_at
        FROM manufacturing_jobs manufacturing JOIN issues issue ON issue.id=manufacturing.issue_id WHERE manufacturing.state='FAILED'
        UNION ALL
        SELECT 'NOTIFICATION_FAILED',55,issue.id,issue.issue_code,notification.id::text,'Customer notification failed',notification.updated_at
        FROM notification_deliveries notification JOIN issues issue ON issue.id=notification.issue_id WHERE notification.status='FAILED'
        UNION ALL
        SELECT 'SUPPORT_AGING',60,issue.id,issue.issue_code,support.id::text,'Open support case is older than 24 hours',support.created_at
        FROM support_requests support JOIN issues issue ON issue.id=support.issue_id
        WHERE support.status='OPEN' AND support.created_at < $2::timestamptz - INTERVAL '24 hours'
      ) attention
      ORDER BY priority DESC,created_at ASC
      LIMIT $1`,
      [Math.min(Math.max(Math.trunc(limit), 1), 100), now, [...this.factoryMappingKeys]],
    );
    return rows.map((row) => ({
      kind: row.kind,
      priority: Number(row.priority),
      issueId: row.issue_id,
      issueCode: row.issue_code,
      targetId: row.target_id,
      detail: row.detail,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    }));
  }
}
