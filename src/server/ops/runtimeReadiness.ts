import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { createQueueSchemaPing, createStorageReadWritePing } from '@/server/runtime/releaseBoundaries';
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
    storagePing: async () => {
      const root = env.ARTWORK_STORAGE_DIR?.trim();
      if (!root) return false;
      return createStorageReadWritePing(root)();
    },
    queuePing: async () => {
      if (!sql) return false;
      return createQueueSchemaPing(sql)();
    },
  });
}
