import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { IssueStatus } from '@/server/issues/IssueRepository';
import type { DesignJobState } from '@/server/design/DesignRepository';
import type {
  ManufacturingInput,
  ManufacturingJobRecord,
  ManufacturingJobState,
  ManufacturingRepository,
} from './ManufacturingRepository';

type InputRow = {
  issue_id: string;
  issue_code: string;
  issue_status: IssueStatus;
  design_job_id: string;
  design_state: DesignJobState;
  artwork_url: string;
  object_type: string;
  size_code: string;
  color_code: string;
  email_payload_version: 1;
  email_key_version: 'v1';
  email_iv: string;
  email_auth_tag: string;
  email_ciphertext: string;
  shipping_payload_version: 1;
  shipping_key_version: 'v1';
  shipping_iv: string;
  shipping_auth_tag: string;
  shipping_ciphertext: string;
};

type JobRow = {
  id: string;
  issue_id: string;
  design_job_id: string;
  state: ManufacturingJobState;
  provider: 'PRINTFUL';
  provider_order_id: string | null;
  provider_status: string | null;
  printful_variant_id: number | null;
  artwork_url: string;
  confirmed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toDate = (value: Date | string) => value instanceof Date ? value : new Date(value);
const payload = (version: 1, keyVersion: 'v1', iv: string, tag: string, ciphertext: string): EncryptedPayload => ({
  version, keyVersion, iv, tag, ciphertext,
});

function fromRow(row: JobRow): ManufacturingJobRecord {
  return {
    id: row.id,
    issueId: row.issue_id,
    designJobId: row.design_job_id,
    state: row.state,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    providerStatus: row.provider_status,
    printfulVariantId: row.printful_variant_id,
    artworkUrl: row.artwork_url,
    confirmedAt: row.confirmed_at ? toDate(row.confirmed_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

const JOB_SELECT = `SELECT id, issue_id, design_job_id, state, provider, provider_order_id,
  provider_status, printful_variant_id, artwork_url, confirmed_at, created_at, updated_at
  FROM manufacturing_jobs`;

export class PostgresManufacturingRepository implements ManufacturingRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async loadInput(issueId: string): Promise<ManufacturingInput | null> {
    const rows = await this.sql.query<InputRow>(
      `SELECT
         issue.id AS issue_id,
         issue.issue_code,
         issue.status AS issue_status,
         design.id AS design_job_id,
         design.state AS design_state,
         design.artwork_url,
         issue.object_type,
         issue.size_code,
         issue.color_code,
         contact.payload_version AS email_payload_version,
         contact.key_version AS email_key_version,
         contact.iv AS email_iv,
         contact.auth_tag AS email_auth_tag,
         contact.ciphertext AS email_ciphertext,
         shipping.payload_version AS shipping_payload_version,
         shipping.key_version AS shipping_key_version,
         shipping.iv AS shipping_iv,
         shipping.auth_tag AS shipping_auth_tag,
         shipping.ciphertext AS shipping_ciphertext
       FROM issues AS issue
       JOIN design_jobs AS design
         ON design.issue_id = issue.id
       JOIN verified_contacts AS contact
         ON contact.id = issue.contact_id
       JOIN shipping_snapshots AS shipping
         ON shipping.id = issue.shipping_snapshot_id
        AND shipping.contact_id = issue.contact_id
       WHERE issue.id = $1::uuid
         AND design.artwork_url IS NOT NULL
       LIMIT 1`,
      [issueId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      issueId: row.issue_id,
      issueCode: row.issue_code,
      issueStatus: row.issue_status,
      designJobId: row.design_job_id,
      designState: row.design_state,
      artworkUrl: row.artwork_url,
      objectType: row.object_type,
      sizeCode: row.size_code,
      colorCode: row.color_code,
      encryptedEmail: payload(
        row.email_payload_version,
        row.email_key_version,
        row.email_iv,
        row.email_auth_tag,
        row.email_ciphertext,
      ),
      encryptedAddress: payload(
        row.shipping_payload_version,
        row.shipping_key_version,
        row.shipping_iv,
        row.shipping_auth_tag,
        row.shipping_ciphertext,
      ),
    };
  }

  async findByIssueId(issueId: string) {
    const rows = await this.sql.query<JobRow>(`${JOB_SELECT} WHERE issue_id=$1::uuid LIMIT 1`, [issueId]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async reserve(job: ManufacturingJobRecord) {
    const rows = await this.sql.query<(JobRow & { created: boolean })>(
      `WITH inserted AS (
         INSERT INTO manufacturing_jobs (
           id, issue_id, design_job_id, state, provider, artwork_url, created_at, updated_at
         )
         SELECT $1::uuid,$2::uuid,$3::uuid,'RESERVED','PRINTFUL',$4,$5,$5
         WHERE EXISTS (
           SELECT 1 FROM issues AS issue
           JOIN design_jobs AS design ON design.id=$3::uuid AND design.issue_id=issue.id
           WHERE issue.id=$2::uuid AND issue.status='DESIGN_APPROVED' AND design.state='APPROVED'
         )
         ON CONFLICT (issue_id) DO NOTHING
         RETURNING *, true AS created
       )
       SELECT * FROM inserted
       UNION ALL
       SELECT existing.*, false AS created
       FROM manufacturing_jobs AS existing
       WHERE existing.issue_id=$2::uuid AND NOT EXISTS (SELECT 1 FROM inserted)
       LIMIT 1`,
      [job.id, job.issueId, job.designJobId, job.artworkUrl, job.createdAt],
    );
    const row = rows[0];
    if (!row) throw new Error('Issue is not eligible for manufacturing');
    return { created: row.created, job: fromRow(row) };
  }

  async attachDraft(input: {
    jobId: string;
    providerOrderId: string;
    providerStatus: string;
    printfulVariantId: number;
    updatedAt: Date;
  }) {
    const rows = await this.sql.query<JobRow>(
      `WITH updated AS (
         UPDATE manufacturing_jobs
         SET state='DRAFT', provider_order_id=$2, provider_status=$3,
             printful_variant_id=$4, failure_code=NULL, updated_at=$5
         WHERE id=$1::uuid AND state IN ('RESERVED','FAILED')
         RETURNING *
       ), issue_update AS (
         UPDATE issues SET status='MANUFACTURING_DRAFT', updated_at=$5
         WHERE id=(SELECT issue_id FROM updated LIMIT 1) AND status='DESIGN_APPROVED'
         RETURNING id
       ), event AS (
         INSERT INTO issue_events (issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'MANUFACTURING_DRAFT','PRINTFUL',jsonb_build_object('provider_order_id',$2),$5
         FROM issue_update RETURNING issue_id
       )
       SELECT * FROM updated WHERE EXISTS (SELECT 1 FROM issue_update)`,
      [input.jobId, input.providerOrderId, input.providerStatus, input.printfulVariantId, input.updatedAt],
    );
    if (!rows[0]) throw new Error('Printful draft could not be attached');
    return fromRow(rows[0]);
  }

  async markConfirmed(input: { jobId: string; confirmedAt: Date }) {
    const rows = await this.sql.query<JobRow>(
      `WITH updated AS (
         UPDATE manufacturing_jobs
         SET state='IN_PRODUCTION', provider_status='confirmed', confirmed_at=$2, updated_at=$2
         WHERE id=$1::uuid AND state='DRAFT'
         RETURNING *
       ), issue_update AS (
         UPDATE issues SET status='IN_PRODUCTION', updated_at=$2
         WHERE id=(SELECT issue_id FROM updated LIMIT 1) AND status='MANUFACTURING_DRAFT'
         RETURNING id
       ), event AS (
         INSERT INTO issue_events (issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'IN_PRODUCTION','PRINTFUL',NULL,$2 FROM issue_update RETURNING issue_id
       )
       SELECT * FROM updated WHERE EXISTS (SELECT 1 FROM issue_update)`,
      [input.jobId, input.confirmedAt],
    );
    if (!rows[0]) throw new Error('Manufacturing draft could not be confirmed');
    return fromRow(rows[0]);
  }

  async markFailed(jobId: string, code: string, updatedAt: Date) {
    await this.sql.query(
      `UPDATE manufacturing_jobs
       SET state='FAILED', failure_code=$2, updated_at=$3
       WHERE id=$1::uuid AND state IN ('RESERVED','FAILED')`,
      [jobId, code.slice(0, 120), updatedAt],
    );
  }
}
