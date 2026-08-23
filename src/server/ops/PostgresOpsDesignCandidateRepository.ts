import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

export type OpsDesignCandidateRecord = {
  id: string;
  issueId: string;
  generationKey: string;
  source: string;
  artworkUrl: string;
  width: number;
  height: number;
  provider: string;
  model: string;
  safeSummary: string | null;
  selected: boolean;
  createdAt: Date;
};

type Row = {
  id: string; issue_id: string; generation_key: string; source: string; artwork_url: string;
  artwork_width: number; artwork_height: number; provider: string; model: string;
  safe_summary: string | null; selected: boolean; created_at: Date | string;
};

export class PostgresOpsDesignCandidateRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async listForIssue(issueId: string, limit = 20): Promise<OpsDesignCandidateRecord[]> {
    const rows = await this.sql.query<Row>(
      `SELECT id,issue_id,generation_key,source,artwork_url,artwork_width,artwork_height,provider,model,safe_summary,selected,created_at
       FROM ops_design_candidates
       WHERE issue_id=$1::uuid
       ORDER BY created_at DESC,id DESC
       LIMIT $2`,
      [issueId, Math.min(Math.max(Math.trunc(limit), 1), 50)],
    );
    return rows.map((row) => ({
      id: row.id,
      issueId: row.issue_id,
      generationKey: row.generation_key,
      source: row.source,
      artworkUrl: row.artwork_url,
      width: row.artwork_width,
      height: row.artwork_height,
      provider: row.provider,
      model: row.model,
      safeSummary: row.safe_summary,
      selected: row.selected,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    }));
  }
}
