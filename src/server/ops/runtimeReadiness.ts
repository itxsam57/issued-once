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
