import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type QueryExecutor = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<Row[]>;
};

export function createStorageReadWritePing(rootValue: string): () => Promise<boolean> {
  const root = resolve(rootValue);
  return async () => {
    const probe = resolve(root, `.issued-once-health-probe-${randomUUID()}`);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const payload = `issued-once:${process.pid}:${randomUUID()}`;
    try {
      await writeFile(probe, payload, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      return (await readFile(probe, 'utf8')) === payload;
    } catch {
      return false;
    } finally {
      await unlink(probe).catch(() => undefined);
    }
  };
}

export function createArtworkStorageSchemaPing(sql: QueryExecutor): () => Promise<boolean> {
  return async () => {
    const rows = await sql.query<{ relation_name: string | null }>(
      "SELECT to_regclass('public.artwork_objects')::text AS relation_name",
    );
    return rows[0]?.relation_name === 'artwork_objects';
  };
}

export function createQueueSchemaPing(sql: QueryExecutor): () => Promise<boolean> {
  return async () => {
    const rows = await sql.query<{ relation_name: string | null }>(
      "SELECT to_regclass('public.background_jobs')::text AS relation_name",
    );
    return rows[0]?.relation_name === 'background_jobs';
  };
}
