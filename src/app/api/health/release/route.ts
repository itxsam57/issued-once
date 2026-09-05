import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { createQueueSchemaPing, createStorageReadWritePing } from '@/server/runtime/releaseBoundaries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runtimeProvider = process.env.RUNTIME_PROVIDER?.trim() || 'unknown';
  const releaseId = process.env.ISSUED_ONCE_RELEASE_ID?.trim()
    || process.env.RELEASE_ID?.trim()
    || process.env.GITHUB_SHA?.trim()
    || 'unknown';
  const version = process.env.APP_VERSION?.trim() || '0.1.0';

  let databaseReady = false;
  let queueReady = false;
  let storageReady = false;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const sql = createNeonSqlExecutor(databaseUrl);
      const rows = await sql.query<{ ok: number }>('SELECT 1 AS ok');
      databaseReady = rows[0]?.ok === 1;
      queueReady = databaseReady ? await createQueueSchemaPing(sql)() : false;
    } catch {
      databaseReady = false;
      queueReady = false;
    }
  }

  const storageRoot = process.env.ARTWORK_STORAGE_DIR?.trim();
  if (storageRoot) {
    try {
      storageReady = await createStorageReadWritePing(storageRoot)();
    } catch {
      storageReady = false;
    }
  }

  const ok = databaseReady && queueReady && storageReady;
  return Response.json(
    { ok, runtimeProvider, releaseId, version, databaseReady, queueReady, storageReady },
    {
      status: ok ? 200 : 503,
      headers: { 'cache-control': 'no-store, max-age=0' },
    },
  );
}
