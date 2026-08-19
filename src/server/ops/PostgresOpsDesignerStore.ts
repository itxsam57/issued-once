import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsDesignerQueueItem, OpsDesignerStore, OpsDesignReworkMode } from './OpsDesignerService';

type QueueRow = {
  issue_id: string; issue_code: string; issue_status: string; object_type: string; size_code: string; color_code: string;
  design_job_id: string; design_state: string; artwork_url: string | null; artwork_width: number | null; artwork_height: number | null;
  provider: string | null; model: string | null; candidate_count: number | string; updated_at: Date | string;
};

type CandidateRow = {
  id: string;
};

export class PostgresOpsDesignerStore implements OpsDesignerStore {
  constructor(private readonly sql: SqlExecutor, private readonly idGenerator: () => string = () => randomUUID()) {}

  async listQueue(limit: number): Promise<OpsDesignerQueueItem[]> {
    const rows = await this.sql.query<QueueRow>(
      `SELECT
        issue.id AS issue_id, issue.issue_code, issue.status AS issue_status,
        issue.object_type, issue.size_code, issue.color_code,
        design.id AS design_job_id, design.state AS design_state,
        design.artwork_url, design.artwork_width, design.artwork_height,
        design.provider, design.model,
        (SELECT COUNT(*) FROM ops_design_candidates candidate WHERE candidate.issue_id=issue.id) AS candidate_count,
        design.updated_at
      FROM design_jobs AS design
      JOIN issues AS issue ON issue.id=design.issue_id
      ORDER BY
        CASE design.state WHEN 'REVIEW' THEN 0 WHEN 'FAILED' THEN 1 WHEN 'GENERATING' THEN 2 WHEN 'INTERPRETING' THEN 3 ELSE 4 END,
        design.updated_at ASC
      LIMIT $1`,
      [Math.min(Math.max(Math.trunc(limit), 1), 100)],
    );
    return rows.map((row) => ({
      issueId: row.issue_id,
      issueCode: row.issue_code,
      issueStatus: row.issue_status,
      objectType: row.object_type,
      sizeCode: row.size_code,
      colorCode: row.color_code,
      designJobId: row.design_job_id,
      designState: row.design_state,
      artworkUrl: row.artwork_url,
      width: row.artwork_width,
      height: row.artwork_height,
      provider: row.provider,
      model: row.model,
      candidateCount: Number(row.candidate_count),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    }));
  }

  async prepareRework(issueId: string, mode: OpsDesignReworkMode) {
    const generationKey = this.idGenerator();
    const rows = await this.sql.query<{ issue_id: string }>(
      `WITH eligible AS (
         SELECT design.*
         FROM design_jobs AS design
         JOIN issues AS issue ON issue.id=design.issue_id
         WHERE issue.id=$1::uuid
           AND issue.status IN ('DESIGN_REVIEW','DESIGN_APPROVED')
           AND design.state IN ('REVIEW','APPROVED')
           AND NOT EXISTS (
             SELECT 1 FROM manufacturing_jobs manufacturing
             WHERE manufacturing.issue_id=issue.id
               AND manufacturing.state IN ('DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED')
           )
         LIMIT 1
       ), archived AS (
         INSERT INTO ops_design_candidates (
           issue_id,design_job_id,generation_key,source,
           brief_payload_version,brief_key_version,brief_iv,brief_auth_tag,brief_ciphertext,
           artwork_url,artwork_mime_type,artwork_bytes,artwork_width,artwork_height,provider,model,selected,created_at
         )
         SELECT issue_id,id,concat('snapshot:',id,':',md5(artwork_url)),'AUTOMATIC',
           brief_payload_version,brief_key_version,brief_iv,brief_auth_tag,brief_ciphertext,
           artwork_url,artwork_mime_type,artwork_bytes,artwork_width,artwork_height,provider,model,false,NOW()
         FROM eligible
         WHERE artwork_url IS NOT NULL AND artwork_mime_type IS NOT NULL AND artwork_bytes IS NOT NULL
           AND artwork_width IS NOT NULL AND artwork_height IS NOT NULL AND provider IS NOT NULL AND model IS NOT NULL
         ON CONFLICT (issue_id,generation_key) DO NOTHING
         RETURNING id
       ), unselected AS (
         UPDATE ops_design_candidates SET selected=false WHERE issue_id=$1::uuid RETURNING id
       ), job_update AS (
         UPDATE design_jobs
         SET state='QUEUED', failure_code=NULL, approved_at=NULL, updated_at=NOW()
         WHERE id=(SELECT id FROM eligible LIMIT 1)
         RETURNING issue_id
       ), issue_update AS (
         UPDATE issues
         SET status='BEING_INTERPRETED', updated_at=NOW()
         WHERE id=(SELECT issue_id FROM job_update LIMIT 1)
           AND status IN ('DESIGN_REVIEW','DESIGN_APPROVED')
         RETURNING id
       ), event AS (
         INSERT INTO issue_events(issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'DESIGN_REWORK_QUEUED','OWNER',jsonb_build_object('mode',$2::text),NOW()
         FROM issue_update RETURNING issue_id
       )
       SELECT id AS issue_id FROM issue_update`,
      [issueId, mode],
    );
    if (!rows[0]) throw new Error('Design cannot be reworked after manufacturing has started');
    return { issueId: rows[0].issue_id, generationKey, mode };
  }

  async selectCandidate(issueId: string, candidateId: string): Promise<void> {
    const rows = await this.sql.query<{ id: string }>(
      `WITH chosen AS (
         SELECT candidate.*
         FROM ops_design_candidates AS candidate
         JOIN issues AS issue ON issue.id=candidate.issue_id
         WHERE candidate.id=$2::uuid AND candidate.issue_id=$1::uuid
           AND issue.status IN ('DESIGN_REVIEW','DESIGN_APPROVED')
           AND NOT EXISTS (
             SELECT 1 FROM manufacturing_jobs manufacturing
             WHERE manufacturing.issue_id=issue.id
               AND manufacturing.state IN ('DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED')
           )
         LIMIT 1
       ), cleared AS (
         UPDATE ops_design_candidates SET selected=false WHERE issue_id=$1::uuid RETURNING id
       ), selected AS (
         UPDATE ops_design_candidates SET selected=true
         WHERE id=(SELECT id FROM chosen LIMIT 1)
         RETURNING *
       ), design_update AS (
         UPDATE design_jobs AS design
         SET state='REVIEW',
             brief_payload_version=selected.brief_payload_version,
             brief_key_version=selected.brief_key_version,
             brief_iv=selected.brief_iv,
             brief_auth_tag=selected.brief_auth_tag,
             brief_ciphertext=selected.brief_ciphertext,
             artwork_url=selected.artwork_url,
             artwork_mime_type=selected.artwork_mime_type,
             artwork_bytes=selected.artwork_bytes,
             artwork_width=selected.artwork_width,
             artwork_height=selected.artwork_height,
             provider=selected.provider,
             model=selected.model,
             approved_at=NULL,
             updated_at=NOW()
         FROM selected
         WHERE design.id=selected.design_job_id
         RETURNING design.issue_id
       ), issue_update AS (
         UPDATE issues SET status='DESIGN_REVIEW', updated_at=NOW()
         WHERE id=(SELECT issue_id FROM design_update LIMIT 1)
           AND status IN ('DESIGN_REVIEW','DESIGN_APPROVED')
         RETURNING id
       ), event AS (
         INSERT INTO issue_events(issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'DESIGN_CANDIDATE_SELECTED','OWNER',jsonb_build_object('candidateId',$2::text),NOW()
         FROM issue_update RETURNING issue_id
       )
       SELECT id FROM issue_update`,
      [issueId, candidateId],
    );
    if (!rows[0]) throw new Error('Design candidate cannot be selected in the current factory state');
  }

  async captureCurrentCandidate(issueId: string, generationKey: string, source: 'AUTOMATIC' | 'OWNER_REGENERATE' | 'OWNER_REINTERPRET') {
    const rows = await this.sql.query<CandidateRow>(
      `INSERT INTO ops_design_candidates (
         issue_id,design_job_id,generation_key,source,
         brief_payload_version,brief_key_version,brief_iv,brief_auth_tag,brief_ciphertext,
         artwork_url,artwork_mime_type,artwork_bytes,artwork_width,artwork_height,provider,model,selected,created_at
       )
       SELECT design.issue_id,design.id,$2,$3,
         design.brief_payload_version,design.brief_key_version,design.brief_iv,design.brief_auth_tag,design.brief_ciphertext,
         design.artwork_url,design.artwork_mime_type,design.artwork_bytes,design.artwork_width,design.artwork_height,design.provider,design.model,true,NOW()
       FROM design_jobs AS design
       WHERE design.issue_id=$1::uuid AND design.state='REVIEW'
         AND design.artwork_url IS NOT NULL AND design.artwork_mime_type IS NOT NULL AND design.artwork_bytes IS NOT NULL
         AND design.artwork_width IS NOT NULL AND design.artwork_height IS NOT NULL AND design.provider IS NOT NULL AND design.model IS NOT NULL
       ON CONFLICT (issue_id,generation_key) DO NOTHING
       RETURNING id`,
      [issueId, generationKey, source],
    );
    if (rows[0]) {
      await this.sql.query(`UPDATE ops_design_candidates SET selected=(id=$2::uuid) WHERE issue_id=$1::uuid`, [issueId, rows[0].id]);
    }
    return rows[0]?.id ?? null;
  }
}
