import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import {
  DEFAULT_DESIGN_POLICY,
  mergeDesignPolicy,
  parseDesignPolicy,
  parseDesignPolicyOverride,
  type DesignPolicy,
  type DesignPolicyOverride,
} from './DesignPolicy';

type GlobalRow = { version: number | string; payload: unknown };
type OverrideRow = { payload: unknown };

function payload(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export class PostgresDesignPolicyRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async getGlobal(): Promise<{ source: 'DEFAULT' | 'ACTIVE'; version: number; policy: DesignPolicy }> {
    const rows = await this.sql.query<GlobalRow>(
      `SELECT version,payload
       FROM ops_website_config_versions
       WHERE config_type='DESIGN_POLICY' AND status='ACTIVE'
       ORDER BY version DESC
       LIMIT 1`,
    );
    const active = rows[0];
    if (!active) return { source: 'DEFAULT', version: 0, policy: DEFAULT_DESIGN_POLICY };
    return {
      source: 'ACTIVE',
      version: Number(active.version),
      policy: parseDesignPolicy(payload(active.payload)),
    };
  }

  async getEffective(issueId: string): Promise<{
    globalVersion: number;
    override: DesignPolicyOverride | null;
    policy: DesignPolicy;
  }> {
    const global = await this.getGlobal();
    const rows = await this.sql.query<OverrideRow>(
      `SELECT payload FROM issue_design_policy_overrides WHERE issue_id=$1::uuid LIMIT 1`,
      [issueId],
    );
    const override = rows[0] ? parseDesignPolicyOverride(payload(rows[0].payload)) : null;
    return {
      globalVersion: global.version,
      override,
      policy: mergeDesignPolicy(global.policy, override),
    };
  }

  async publishGlobal(input: DesignPolicy): Promise<number> {
    const policy = parseDesignPolicy(input);
    const rows = await this.sql.query<{ version: number | string }>(
      `WITH next AS (
         SELECT COALESCE(MAX(version),0)+1 AS version
         FROM ops_website_config_versions
         WHERE config_type='DESIGN_POLICY'
       ), retired AS (
         UPDATE ops_website_config_versions
         SET status='RETIRED'
         WHERE config_type='DESIGN_POLICY' AND status='ACTIVE'
         RETURNING id
       ), inserted AS (
         INSERT INTO ops_website_config_versions(config_type,version,status,payload,created_at,published_at)
         SELECT 'DESIGN_POLICY',next.version,'ACTIVE',$1::jsonb,NOW(),NOW()
         FROM next
         RETURNING version
       )
       SELECT version FROM inserted`,
      [JSON.stringify(policy)],
    );
    if (!rows[0]) throw new Error('Design policy could not be published');
    return Number(rows[0].version);
  }

  async setIssueOverride(issueId: string, input: DesignPolicyOverride | null): Promise<void> {
    if (input === null) {
      await this.sql.query(`DELETE FROM issue_design_policy_overrides WHERE issue_id=$1::uuid`, [issueId]);
      return;
    }
    const override = parseDesignPolicyOverride(input);
    await this.sql.query(
      `INSERT INTO issue_design_policy_overrides(issue_id,payload,created_at,updated_at)
       VALUES ($1::uuid,$2::jsonb,NOW(),NOW())
       ON CONFLICT (issue_id)
       DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()`,
      [issueId, JSON.stringify(override)],
    );
  }
}
