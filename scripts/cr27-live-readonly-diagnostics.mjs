import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL is unavailable');

const sql = neon(connectionString);

const relations = await sql`
  SELECT
    to_regclass('public.experiences')::text AS experiences_table,
    to_regclass('public.experience_physical_selection')::text AS physical_table,
    to_regclass('public.ops_website_config_versions')::text AS config_table,
    to_regclass('public.payment_attempts')::text AS payments_table
`;
const relationState = relations[0] ?? {};
console.log(
  `CR27_RELATIONS experiences=${Boolean(relationState.experiences_table)} physical=${Boolean(relationState.physical_table)} config=${Boolean(relationState.config_table)} payments=${Boolean(relationState.payments_table)}`,
);

let activeCatalogCount = -1;
let catalogRowCount = -1;
if (relationState.config_table) {
  const counts = await sql`
    SELECT
      count(*) FILTER (WHERE config_type = 'CATALOG')::int AS catalog_rows,
      count(*) FILTER (WHERE config_type = 'CATALOG' AND status = 'ACTIVE')::int AS active_catalog_rows
    FROM public.ops_website_config_versions
  `;
  catalogRowCount = Number(counts[0]?.catalog_rows ?? 0);
  activeCatalogCount = Number(counts[0]?.active_catalog_rows ?? 0);
}
console.log(`CR27_CATALOG rows=${catalogRowCount} active=${activeCatalogCount}`);

let physicalConstraintHasTote = false;
if (relationState.physical_table) {
  const constraints = await sql`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.experience_physical_selection'::regclass
      AND contype = 'c'
  `;
  physicalConstraintHasTote = constraints.some((row) => String(row.definition ?? '').toLowerCase().includes('tote'));
}
console.log(`CR27_PHYSICAL_CONSTRAINT tote=${physicalConstraintHasTote}`);

if (!relationState.experiences_table || !relationState.physical_table || !relationState.config_table) {
  process.exitCode = 2;
}
