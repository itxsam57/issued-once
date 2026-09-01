import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const MIGRATION_URL = new URL('../db/migrations/0036_durable_artwork_objects.sql', import.meta.url);

function compact(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, '');
}

export function validateMigrationSource(source) {
  const required = [
    /create table if not exists artwork_objects/i,
    /locator text primary key/i,
    /issue_id uuid not null references issues\(id\) on delete cascade/i,
    /design_job_id text not null/i,
    /content_sha256 text not null/i,
    /locator like 'artwork:\/\/%'/i,
    /octet_length\(bytes\) = byte_count/i,
    /unique \(issue_id, design_job_id\)/i,
    /create index if not exists artwork_objects_issue_created_idx/i,
    /on artwork_objects\(issue_id, created_at desc\)/i,
  ];
  for (const pattern of required) {
    if (!pattern.test(source)) throw new Error(`0036 source contract mismatch: ${pattern}`);
  }
  const statements = source
    .trim()
    .split(/;\s*(?=\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  if (statements.length !== 2) {
    throw new Error(`0036 source contract mismatch: expected 2 SQL statements, found ${statements.length}`);
  }
  return statements;
}

async function inspectArtworkSchema(sql, { requireIndex }) {
  const columns = await sql`
    SELECT column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'artwork_objects'
    ORDER BY ordinal_position
  `;
  const expected = [
    ['locator', 'text'],
    ['issue_id', 'uuid'],
    ['design_job_id', 'text'],
    ['mime_type', 'text'],
    ['bytes', 'bytea'],
    ['byte_count', 'int8'],
    ['content_sha256', 'text'],
    ['created_at', 'timestamptz'],
  ];
  if (columns.length !== expected.length) {
    throw new Error(`0036 schema mismatch: expected ${expected.length} columns, found ${columns.length}`);
  }
  expected.forEach(([name, type], index) => {
    const column = columns[index];
    if (column.column_name !== name || column.udt_name !== type || column.is_nullable !== 'NO') {
      throw new Error(`0036 schema mismatch at column ${name}`);
    }
  });
  if (!compact(columns[7].column_default).includes('now()')) {
    throw new Error('0036 schema mismatch: created_at default');
  }

  const constraints = await sql`
    SELECT contype, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.artwork_objects'::regclass
  `;
  const defs = constraints.map((row) => ({ type: row.contype, text: compact(row.definition) }));
  const has = (type, predicate) => defs.some((entry) => entry.type === type && predicate(entry.text));
  if (!has('p', (d) => d.includes('primarykey(locator)'))) throw new Error('0036 schema mismatch: locator primary key');
  if (!has('u', (d) => d.includes('unique(issue_id,design_job_id)'))) throw new Error('0036 schema mismatch: issue/design uniqueness');
  if (!has('f', (d) => d.includes('foreignkey(issue_id)referencesissues(id)ondeletecascade')) &&
      !has('f', (d) => d.includes('foreignkey(issue_id)referencespublic.issues(id)ondeletecascade'))) {
    throw new Error('0036 schema mismatch: issues foreign key');
  }
  const allDefs = defs.map((entry) => entry.text);
  if (!allDefs.some((d) => d.includes("mime_type='image/png'") || d.includes("mime_type='image/png'::text"))) {
    throw new Error('0036 schema mismatch: PNG MIME check');
  }
  if (!allDefs.some((d) => d.includes('byte_count>0'))) throw new Error('0036 schema mismatch: positive byte count check');
  if (!allDefs.some((d) => d.includes('octet_length(bytes)=byte_count'))) throw new Error('0036 schema mismatch: byte integrity check');
  if (!allDefs.some((d) => d.includes('content_sha256~') && d.includes('[0-9a-f]'))) {
    throw new Error('0036 schema mismatch: SHA-256 format check');
  }
  if (!allDefs.some((d) => (d.includes("locatorlike'artwork://%'") || d.includes("locator~~'artwork://%'")))) {
    throw new Error('0036 schema mismatch: private locator check');
  }

  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'artwork_objects'
  `;
  const named = indexes.find((row) => row.indexname === 'artwork_objects_issue_created_idx');
  if (named) {
    const definition = compact(named.indexdef);
    if (!definition.includes('(issue_id,created_atdesc)')) {
      throw new Error('0036 schema mismatch: issue/created index definition');
    }
  } else if (requireIndex) {
    throw new Error('0036 schema mismatch: issue/created index absent');
  }
}

export async function applyApproved0036({ connectionString = process.env.DATABASE_URL } = {}) {
  if (!connectionString) throw new Error('DATABASE_URL is unavailable; no SQL executed');
  const source = await readFile(MIGRATION_URL, 'utf8');
  const statements = validateMigrationSource(source);
  const sql = neon(connectionString);

  const relations = await sql`
    SELECT
      to_regclass('public.issues')::text AS issues_table,
      to_regclass('public.artwork_objects')::text AS artwork_objects_table
  `;
  const state = relations[0] ?? {};
  if (!state.issues_table) throw new Error('0036 preflight failed: public.issues does not exist');

  const existed = Boolean(state.artwork_objects_table);
  if (existed) await inspectArtworkSchema(sql, { requireIndex: false });
  console.log(`0036 preflight: issues=present artwork_objects=${existed ? 'present-compatible' : 'absent'}`);

  for (const statement of statements) {
    await sql.query(statement);
  }

  await inspectArtworkSchema(sql, { requireIndex: true });
  console.log(`0036 verified: artwork_objects=${existed ? 'already-compatible' : 'created'} index=present`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (process.argv.includes('--contract-only')) {
    const source = await readFile(MIGRATION_URL, 'utf8');
    validateMigrationSource(source);
    console.log('0036 source contract verified; no database connection attempted');
  } else {
    await applyApproved0036();
  }
}
