import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import { publishVersionedConfig } from '@/server/config/PostgresVersionedConfig';
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
    return publishVersionedConfig(this.sql, 'DESIGN_POLICY', policy);
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
