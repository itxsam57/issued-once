import { neon } from '@neondatabase/serverless';
import type { SqlExecutor } from './PostgresExperienceRepository';

export function createNeonSqlExecutor(databaseUrl: string): SqlExecutor {
  const sql = neon(databaseUrl);

  return {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<Row[]> {
      const rows = await sql.query(text, Array.from(params));
      return rows as Row[];
    },
    async transaction(statements) {
      const results = await sql.transaction((tx) => statements.map((statement) =>
        tx.query(statement.text, Array.from(statement.params ?? [])),
      ));
      return results as Array<Array<Record<string, unknown>>>;
    },
  };
}
