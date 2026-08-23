import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsDesignerQueueItem, OpsDesignerStore, OpsDesignReworkMode } from './OpsDesignerService';

type QueueRow = {
  issue_id: string; issue_code: string; issue_status: string; object_type: string; size_code: string; color_code: string;
  design_job_id: string; design_state: string; artwork_url: string | null; artwork_width: number | null; artwork_height: number | null;
  provider: string | null; model: string | null; candidate_count: number | string; updated_at: Date | string;
};

type CandidateRow = { id: string };

export class PostgresOpsDesignerStore implements OpsDesignerStore {
  constructor(private readonly sql: SqlExecutor, private readonly idGenerator: () => string = () => randomUUID()) {}

  async listQueue(limit: number): Promise<OpsDesignerQueueItem[]> {
    const rows = await this.sql.query<QueueRow>(
      `SELECT issue.id AS issue_id, issue.issue_code, issue.status AS issue_status,
        issue.object_type, issue.size_code, issue.color_code,
        design.id AS design_job_id, design.state AS design_state,
        design.artwork_url, design.artwork_width, design.artwork_height,
        design.provider, design.model,
        (SELECT COUNT(*) FROM ops_design_candidates candidate WHERE candidate.issue_id=issue.id) AS candidate_count,
        design.updated_at
      FROM design_jobs AS design
      JOIN issues AS issue ON issue.id=design.issue_id
      ORDER BY CASE design.state WHEN 'REVIEW' THEN 0 WHEN 'FAILED' THEN 1 WHEN 'GENERATING' THEN 2 WHEN 'INTERPRETING' THEN 3 ELSE 4 END,
        design.updated_at ASC
      LIMIT $1`,
      [Math.min(Math.max(Math.trunc(limit), 1), 100)],
    );
    return rows.map((row) => ({
      issueId: row.issue_id, issueCode: row.issue_code, issueStatus: row.issue_status,
      objectType: row.object_type, sizeCode: row.size_code, colorCode: row.color_code,
      designJobId: row.design_job_id, designState: row.design_state, artworkUrl: row.artwork_url,
      width: row.artwork_width, height: row.artwork_height, provider: row.provider, model: row.model,
      candidateCount: Number(row.candidate_count),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    }));
  }

  async prepareRetry(issueId: string) {
    const generationKey = `retry:${this.idGenerator()}`;
    const rows = await this.sql.query<{ issue_id: string }>(
      `UPDATE design_jobs AS design
       SET state='QUEUED', failure_code=NULL, updated_at=NOW()
       FROM issues AS issue
       WHERE design.issue_id=issue.id
         AND issue.id=$1::uuid
         AND issue.status='BEING_INTERPRETED'
         AND design.state='FAILED'
       RETURNING design.issue_id`,
      [issueId],
    );
    if (!rows[0]) throw new Error('Only a failed design can be retried');
    return { issueId: rows[0].issue_id, generationKey };
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
         UPDATE issues SET status='BEING_INTERPRETED', updated_at=NOW()
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

  async prepareManualUpload(issueId: string) {
    const designJobId = this.idGenerator();
    const rows = await this.sql.query<{ design_job_id: string; object_type: string }>(
      `WITH eligible AS (
         SELECT issue.id, issue.object_type, issue.status
         FROM issues AS issue
         WHERE issue.id=$1::uuid
           AND issue.status IN ('RECEIVED','BEING_INTERPRETED','DESIGN_REVIEW','DESIGN_APPROVED')
           AND NOT EXISTS (
             SELECT 1 FROM manufacturing_jobs AS manufacturing
             WHERE manufacturing.issue_id=issue.id
               AND manufacturing.state IN ('DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED')
           )
         FOR UPDATE
       ), existing AS (
         SELECT design.id AS design_job_id, eligible.object_type
         FROM eligible
         JOIN design_jobs AS design ON design.issue_id=eligible.id
         LIMIT 1
       ), inserted AS (
         INSERT INTO design_jobs (id,issue_id,state,created_at,updated_at)
         SELECT $2::uuid,eligible.id,'QUEUED',NOW(),NOW()
         FROM eligible
         WHERE eligible.status IN ('RECEIVED','BEING_INTERPRETED')
           AND NOT EXISTS (SELECT 1 FROM existing)
         ON CONFLICT (issue_id) DO NOTHING
         RETURNING id AS design_job_id,issue_id
       ), resolved AS (
         SELECT existing.design_job_id,existing.object_type FROM existing
         UNION ALL
         SELECT inserted.design_job_id,eligible.object_type
         FROM inserted JOIN eligible ON eligible.id=inserted.issue_id
       ), issue_update AS (
         UPDATE issues SET status='BEING_INTERPRETED',updated_at=NOW()
         WHERE id=$1::uuid AND status='RECEIVED'
           AND EXISTS (SELECT 1 FROM resolved)
         RETURNING id
       ), event AS (
         INSERT INTO issue_events(issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'BEING_INTERPRETED','OWNER',jsonb_build_object('mode','manual'),NOW()
         FROM issue_update RETURNING issue_id
       )
       SELECT design_job_id,object_type FROM resolved LIMIT 1`,
      [issueId, designJobId],
    );
    if (!rows[0]) throw new Error('Issue is not eligible for manual artwork upload');
    return { designJobId: rows[0].design_job_id, objectType: rows[0].object_type };
  }

  async saveManualCandidate(input: {
    issueId: string;
    designJobId: string;
    generationKey: string;
    source: 'OWNER_UPLOAD';
    artworkUrl: string;
    artworkMimeType: 'image/png';
    artworkBytes: number;
    width: number;
    height: number;
    provider: 'OWNER';
    model: 'MANUAL_UPLOAD';
    safeSummary: string;
  }) {
    const rows = await this.sql.query<{ candidate_id: string }>(
      `WITH eligible AS (
         SELECT design.id AS design_job_id,design.issue_id
         FROM design_jobs AS design
         JOIN issues AS issue ON issue.id=design.issue_id
         WHERE issue.id=$1::uuid
           AND design.id=$2::uuid
           AND issue.status IN ('BEING_INTERPRETED','DESIGN_REVIEW','DESIGN_APPROVED')
           AND NOT EXISTS (
             SELECT 1 FROM manufacturing_jobs AS manufacturing
             WHERE manufacturing.issue_id=issue.id
               AND manufacturing.state IN ('DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED')
           )
         FOR UPDATE OF design,issue
       ), archived AS (
         INSERT INTO ops_design_candidates (
           issue_id,design_job_id,generation_key,source,
           brief_payload_version,brief_key_version,brief_iv,brief_auth_tag,brief_ciphertext,
           artwork_url,artwork_mime_type,artwork_bytes,artwork_width,artwork_height,provider,model,selected,created_at
         )
         SELECT design.issue_id,design.id,concat('snapshot:',design.id,':',md5(design.artwork_url)),'AUTOMATIC',
           design.brief_payload_version,design.brief_key_version,design.brief_iv,design.brief_auth_tag,design.brief_ciphertext,
           design.artwork_url,design.artwork_mime_type,design.artwork_bytes,design.artwork_width,design.artwork_height,
           design.provider,design.model,false,NOW()
         FROM design_jobs AS design
         JOIN eligible ON eligible.design_job_id=design.id
         WHERE design.artwork_url IS NOT NULL AND design.artwork_mime_type IS NOT NULL AND design.artwork_bytes IS NOT NULL
           AND design.artwork_width IS NOT NULL AND design.artwork_height IS NOT NULL AND design.provider IS NOT NULL AND design.model IS NOT NULL
         ON CONFLICT (issue_id,generation_key) DO NOTHING
         RETURNING id
       ), cleared AS (
         UPDATE ops_design_candidates SET selected=false
         WHERE issue_id=$1::uuid AND EXISTS (SELECT 1 FROM eligible)
         RETURNING id
       ), inserted AS (
         INSERT INTO ops_design_candidates (
           issue_id,design_job_id,generation_key,source,
           artwork_url,artwork_mime_type,artwork_bytes,artwork_width,artwork_height,
           provider,model,safe_summary,selected,created_at
         )
         SELECT eligible.issue_id,eligible.design_job_id,$3,'OWNER_UPLOAD',$4,$5,$6,$7,$8,$9,$10,$11,true,NOW()
         FROM eligible
         WHERE (SELECT COUNT(*) FROM cleared) >= 0
         RETURNING id,issue_id,design_job_id
       ), design_update AS (
         UPDATE design_jobs AS design
         SET state='REVIEW',
             brief_payload_version=NULL,brief_key_version=NULL,brief_iv=NULL,brief_auth_tag=NULL,brief_ciphertext=NULL,
             artwork_url=$4,artwork_mime_type=$5,artwork_bytes=$6,artwork_width=$7,artwork_height=$8,
             provider=$9,model=$10,failure_code=NULL,approved_at=NULL,updated_at=NOW()
         FROM inserted
         WHERE design.id=inserted.design_job_id AND design.issue_id=inserted.issue_id
         RETURNING design.issue_id
       ), issue_update AS (
         UPDATE issues SET status='DESIGN_REVIEW',updated_at=NOW()
         WHERE id=(SELECT issue_id FROM design_update LIMIT 1)
           AND status IN ('BEING_INTERPRETED','DESIGN_REVIEW','DESIGN_APPROVED')
         RETURNING id
       ), event AS (
         INSERT INTO issue_events(issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'DESIGN_REVIEW','OWNER',jsonb_build_object('source','OWNER_UPLOAD'),NOW()
         FROM issue_update RETURNING issue_id
       )
       SELECT inserted.id AS candidate_id
       FROM inserted
       WHERE EXISTS (SELECT 1 FROM issue_update)`,
      [input.issueId,input.designJobId,input.generationKey,input.artworkUrl,input.artworkMimeType,
       input.artworkBytes,input.width,input.height,input.provider,input.model,input.safeSummary],
    );
    if (!rows[0]) throw new Error('Manual artwork cannot be saved in the current factory state');
    return { candidateId: rows[0].candidate_id };
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
         design.artwork_url,design.artwork_mime_type,design.artwork_bytes,design.artwork_width,design.artwork_height,design.provider,design.model,false,NOW()
       FROM design_jobs AS design
       WHERE design.issue_id=$1::uuid AND design.state='REVIEW'
         AND design.artwork_url IS NOT NULL AND design.artwork_mime_type IS NOT NULL AND design.artwork_bytes IS NOT NULL
         AND design.artwork_width IS NOT NULL AND design.artwork_height IS NOT NULL AND design.provider IS NOT NULL AND design.model IS NOT NULL
       ON CONFLICT (issue_id,generation_key) DO NOTHING
       RETURNING id`,
      [issueId, generationKey, source],
    );
    const candidateId = rows[0]?.id;
    if (candidateId) {
      await this.sql.query(`UPDATE ops_design_candidates SET selected=false WHERE issue_id=$1::uuid AND selected=true`, [issueId]);
      await this.sql.query(`UPDATE ops_design_candidates SET selected=true WHERE id=$1::uuid AND issue_id=$2::uuid`, [candidateId, issueId]);
    }
    return candidateId ?? null;
  }
}
