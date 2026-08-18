import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { IssueStatus } from '@/server/issues/IssueRepository';
import type {
  DesignInput,
  DesignJobRecord,
  DesignJobState,
  DesignRepository,
} from './DesignRepository';

type InputRow = {
  issue_id: string; issue_code: string; issue_status: IssueStatus; object_type: string;
  size_code: string; color_code: string; slot: DesignInput['questions'][number]['slot'];
  question_id: string; question_version: number; family: string; prompt_snapshot: string;
  payload_version: 1; key_version: 'v1'; iv: string; auth_tag: string; ciphertext: string;
};
type JobRow = {
  id: string; issue_id: string; state: DesignJobState;
  brief_payload_version: 1 | null; brief_key_version: 'v1' | null; brief_iv: string | null;
  brief_auth_tag: string | null; brief_ciphertext: string | null; artwork_url: string | null;
  artwork_mime_type: string | null; artwork_bytes: number | string | null; artwork_width: number | null;
  artwork_height: number | null; provider: string | null; model: string | null;
  created_at: Date | string; updated_at: Date | string;
};

const toDate = (v: Date | string) => v instanceof Date ? v : new Date(v);
function encrypted(version: 1, keyVersion: 'v1', iv: string, tag: string, ciphertext: string): EncryptedPayload {
  return { version, keyVersion, iv, tag, ciphertext };
}
function jobFromRow(r: JobRow): DesignJobRecord {
  return {
    id: r.id, issueId: r.issue_id, state: r.state,
    encryptedBrief: r.brief_payload_version && r.brief_key_version && r.brief_iv && r.brief_auth_tag && r.brief_ciphertext
      ? encrypted(r.brief_payload_version, r.brief_key_version, r.brief_iv, r.brief_auth_tag, r.brief_ciphertext)
      : null,
    artworkUrl: r.artwork_url, artworkMimeType: r.artwork_mime_type,
    artworkBytes: r.artwork_bytes === null ? null : Number(r.artwork_bytes),
    width: r.artwork_width, height: r.artwork_height, provider: r.provider, model: r.model,
    createdAt: toDate(r.created_at), updatedAt: toDate(r.updated_at),
  };
}
const JOB_SELECT = `SELECT id, issue_id, state, brief_payload_version, brief_key_version, brief_iv,
  brief_auth_tag, brief_ciphertext, artwork_url, artwork_mime_type, artwork_bytes,
  artwork_width, artwork_height, provider, model, created_at, updated_at FROM design_jobs`;

export class PostgresDesignRepository implements DesignRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async loadInput(issueId: string): Promise<DesignInput | null> {
    const rows = await this.sql.query<InputRow>(
      `SELECT issue.id AS issue_id, issue.issue_code, issue.status AS issue_status,
              issue.object_type, issue.size_code, issue.color_code,
              assigned.slot, assigned.question_id, assigned.question_version, assigned.family,
              assigned.prompt_snapshot,
              answer.payload_version, answer.key_version, answer.iv, answer.auth_tag, answer.ciphertext
       FROM issues AS issue
       JOIN experience_question_set_items AS assigned ON assigned.experience_id = issue.experience_id
       JOIN experience_answers AS answer
         ON answer.experience_id = issue.experience_id AND answer.question_id = assigned.slot
       WHERE issue.id = $1::uuid
       ORDER BY assigned.ordinal ASC`,
      [issueId],
    );
    if (!rows.length) return null;
    if (rows.length !== 7) throw new Error('Paid issue does not have seven answer records');
    const first = rows[0];
    return {
      issueId: first.issue_id, issueCode: first.issue_code, issueStatus: first.issue_status,
      objectType: first.object_type, sizeCode: first.size_code, colorCode: first.color_code,
      questions: rows.map((row) => ({
        slot: row.slot, questionId: row.question_id, questionVersion: Number(row.question_version),
        family: row.family, prompt: row.prompt_snapshot,
        encryptedAnswer: encrypted(row.payload_version, row.key_version, row.iv, row.auth_tag, row.ciphertext),
      })),
    };
  }

  async findByIssueId(issueId: string) {
    const rows = await this.sql.query<JobRow>(`${JOB_SELECT} WHERE issue_id=$1::uuid LIMIT 1`, [issueId]);
    return rows[0] ? jobFromRow(rows[0]) : null;
  }

  async begin(job: DesignJobRecord) {
    const rows = await this.sql.query<(JobRow & { created: boolean })>(
      `WITH inserted AS (
         INSERT INTO design_jobs (id,issue_id,state,created_at,updated_at)
         SELECT $1::uuid,$2::uuid,'QUEUED',$3,$3
         WHERE EXISTS (SELECT 1 FROM issues WHERE id=$2::uuid AND status='RECEIVED')
         ON CONFLICT (issue_id) DO NOTHING
         RETURNING *, true AS created
       ), transitioned AS (
         UPDATE issues SET status='BEING_INTERPRETED', updated_at=$3
         WHERE id=$2::uuid AND EXISTS (SELECT 1 FROM inserted)
         RETURNING id
       ), event AS (
         INSERT INTO issue_events (issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'BEING_INTERPRETED','DESIGN',NULL,$3 FROM transitioned
         RETURNING issue_id
       )
       SELECT * FROM inserted
       UNION ALL
       SELECT existing.*, false AS created FROM design_jobs AS existing
       WHERE existing.issue_id=$2::uuid AND NOT EXISTS (SELECT 1 FROM inserted)
       LIMIT 1`,
      [job.id, job.issueId, job.createdAt],
    );
    const row = rows[0];
    if (!row) throw new Error('Issue is not eligible for design');
    return { created: row.created, job: jobFromRow(row) };
  }

  async claim(jobId: string, updatedAt: Date) {
    const rows = await this.sql.query<{ id: string }>(
      `UPDATE design_jobs
       SET state='INTERPRETING', failure_code=NULL, updated_at=$2
       WHERE id=$1::uuid AND state IN ('QUEUED','FAILED')
       RETURNING id`,
      [jobId, updatedAt],
    );
    return Boolean(rows[0]);
  }

  async saveGenerated(input: {
    jobId: string; encryptedBrief: EncryptedPayload; artworkUrl: string; artworkMimeType: string;
    artworkBytes: number; width: number; height: number; provider: string; model: string; updatedAt: Date;
  }) {
    const b = input.encryptedBrief;
    const rows = await this.sql.query<JobRow>(
      `WITH updated AS (
         UPDATE design_jobs SET state='REVIEW', brief_payload_version=$2, brief_key_version=$3,
           brief_iv=$4, brief_auth_tag=$5, brief_ciphertext=$6, artwork_url=$7,
           artwork_mime_type=$8, artwork_bytes=$9, artwork_width=$10, artwork_height=$11,
           provider=$12, model=$13, failure_code=NULL, updated_at=$14
         WHERE id=$1::uuid AND state IN ('INTERPRETING','GENERATING')
         RETURNING *
       ), issue_update AS (
         UPDATE issues SET status='DESIGN_REVIEW', updated_at=$14
         WHERE id=(SELECT issue_id FROM updated LIMIT 1) RETURNING id
       ), event AS (
         INSERT INTO issue_events (issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'DESIGN_REVIEW','DESIGN',NULL,$14 FROM issue_update RETURNING issue_id
       ) SELECT * FROM updated`,
      [input.jobId,b.version,b.keyVersion,b.iv,b.tag,b.ciphertext,input.artworkUrl,input.artworkMimeType,
       input.artworkBytes,input.width,input.height,input.provider,input.model,input.updatedAt],
    );
    if (!rows[0]) throw new Error('Design job could not be completed');
    return jobFromRow(rows[0]);
  }

  async markFailed(jobId: string, code: string, updatedAt: Date) {
    await this.sql.query(
      `UPDATE design_jobs SET state='FAILED', failure_code=$2, updated_at=$3
       WHERE id=$1::uuid AND state<>'APPROVED'`,
      [jobId, code.slice(0, 120), updatedAt],
    );
  }
}
