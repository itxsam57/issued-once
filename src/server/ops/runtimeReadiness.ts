import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { createArtworkStorageSchemaPing, createQueueSchemaPing } from '@/server/runtime/releaseBoundaries';
import { ReadinessService } from './ReadinessService';

export function createReadinessService() {
  const env = process.env;
  const databaseUrl = env.DATABASE_URL?.trim();
  const sql = databaseUrl ? createNeonSqlExecutor(databaseUrl) : null;

  return new ReadinessService({
    env,
    databasePing: async () => {
      if (!sql) return false;
      const rows = await sql.query<{ ok: number }>('SELECT 1 AS ok');
      return rows[0]?.ok === 1;
    },
    catalogAuthorityPing: async () => {
      if (!sql) return false;
      const rows = await sql.query<{ ok: number }>(
        `SELECT 1 AS ok FROM ops_website_config_versions WHERE config_type='CATALOG' AND status='ACTIVE' ORDER BY version DESC LIMIT 1`,
      );
      return rows[0]?.ok === 1;
    },
    legacyPrivacyPayloadsExist: async () => {
      if (!sql) return true;
      const rows = await sql.query<{ has_legacy: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM experience_answers WHERE key_version='v1'
          UNION ALL SELECT 1 FROM otp_challenges WHERE email_key_version='v1'
          UNION ALL SELECT 1 FROM verified_contacts WHERE key_version='v1'
          UNION ALL SELECT 1 FROM shipping_snapshots WHERE key_version='v1'
          UNION ALL SELECT 1 FROM support_requests WHERE key_version='v1'
          UNION ALL SELECT 1 FROM design_jobs WHERE brief_key_version='v1'
          UNION ALL SELECT 1 FROM ops_design_candidates WHERE brief_key_version='v1'
          LIMIT 1
        ) AS has_legacy
      `);
      return rows[0]?.has_legacy === true;
    },
    privacySchemaPing: async () => {
      if (!sql) return false;
      const rows = await sql.query<{ ready_constraints: number | string }>(`
        SELECT COUNT(*) AS ready_constraints
        FROM pg_constraint
        WHERE conrelid IN ('design_jobs'::regclass, 'ops_design_candidates'::regclass)
          AND conname IN ('design_jobs_check', 'ops_design_candidates_check')
          AND pg_get_constraintdef(oid) ILIKE '%v2%'
      `);
      return Number(rows[0]?.ready_constraints ?? 0) === 2;
    },
    storagePing: async () => {
      if (!sql) return false;
      return createArtworkStorageSchemaPing(sql)();
    },
    queuePing: async () => {
      if (!sql) return false;
      return createQueueSchemaPing(sql)();
    },
  });
}
