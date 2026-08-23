import { issueSignedToken } from '@vercel/blob';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { ReadinessService } from './ReadinessService';

export function createReadinessService() {
  const env = process.env;

  return new ReadinessService({
    env,
    databasePing: async () => {
      const databaseUrl = env.DATABASE_URL?.trim();
      if (!databaseUrl) return false;
      const sql = createNeonSqlExecutor(databaseUrl);
      const rows = await sql.query<{ ok: number }>('SELECT 1 AS ok');
      return rows[0]?.ok === 1;
    },
    blobPing: async () => {
      const token = env.BLOB_READ_WRITE_TOKEN?.trim();
      if (!token) return false;
      const signed = await issueSignedToken({
        pathname: 'readiness/probe.txt',
        operations: ['get'],
        validUntil: Date.now() + 60_000,
        token,
      });
      return Boolean(signed.delegationToken && signed.clientSigningToken);
    },
  });
}
