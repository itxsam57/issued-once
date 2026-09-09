import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

export type VersionedConfigType = 'CATALOG' | 'DESIGN_POLICY';

export async function publishVersionedConfig(
  sql: SqlExecutor,
  configType: VersionedConfigType,
  value: unknown,
): Promise<number> {
  if (!sql.transaction) {
    throw new Error('Atomic website config publication is unavailable');
  }

  const results = await sql.transaction([
    {
      text: 'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
      params: [`ops_website_config_versions:${configType}`],
    },
    {
      text: `UPDATE ops_website_config_versions
             SET status='RETIRED'
             WHERE config_type=$1 AND status='ACTIVE'`,
      params: [configType],
    },
    {
      text: `INSERT INTO ops_website_config_versions(
               config_type,version,status,payload,created_at,published_at
             )
             SELECT $1,COALESCE(MAX(version),0)+1,'ACTIVE',$2::jsonb,NOW(),NOW()
             FROM ops_website_config_versions
             WHERE config_type=$1
             RETURNING version`,
      params: [configType, JSON.stringify(value)],
    },
  ]);

  const row = results[2]?.[0] as { version?: number | string } | undefined;
  if (!row?.version) throw new Error(`${configType} config could not be published`);
  return Number(row.version);
}
