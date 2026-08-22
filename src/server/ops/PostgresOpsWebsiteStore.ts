import { QUESTION_VAULT } from '@/domain/questions/QuestionVault';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsCatalogPayload, OpsQuestionControl, OpsWebsiteState, OpsWebsiteStore } from './OpsWebsiteService';

type CatalogRow = { version: number; payload: OpsCatalogPayload | string };
type QuestionRow = {
  question_id: string; question_version: number; family: string; prompt: string; kind: 'text'|'choice'; optional: boolean;
  choices: unknown; active: boolean; weight: number | string; usage_count: number | string;
};

export class PostgresOpsWebsiteStore implements OpsWebsiteStore {
  constructor(private readonly sql: SqlExecutor, private readonly bootCatalog: OpsCatalogPayload) {}

  private async seedQuestions() {
    await this.sql.query(
      `INSERT INTO question_definitions (question_id,question_version,family,prompt,kind,optional,choices,active,weight,created_at)
       SELECT "id","version",family,prompt,kind,optional,choices,active,weight,NOW()
       FROM jsonb_to_recordset($1::jsonb) AS q(
         "id" text,"version" integer,family text,prompt text,kind text,optional boolean,choices jsonb,active boolean,weight double precision
       )
       ON CONFLICT (question_id,question_version) DO NOTHING`,
      [JSON.stringify(QUESTION_VAULT.map((question) => ({ ...question, choices: question.choices ?? null })))],
    );
  }

  async getState(): Promise<OpsWebsiteState> {
    await this.seedQuestions();
    const [catalogRows, questionRows] = await Promise.all([
      this.sql.query<CatalogRow>(`SELECT version,payload FROM ops_website_config_versions WHERE config_type='CATALOG' AND status='ACTIVE' ORDER BY version DESC LIMIT 1`),
      this.sql.query<QuestionRow>(
        `SELECT definition.question_id,definition.question_version,definition.family,definition.prompt,definition.kind,definition.optional,
          definition.choices,definition.active,definition.weight,
          (SELECT COUNT(*) FROM experience_question_set_items item WHERE item.question_id=definition.question_id AND item.question_version=definition.question_version) AS usage_count
         FROM question_definitions AS definition
         ORDER BY definition.family,definition.question_id,definition.question_version DESC`,
      ),
    ]);
    const active = catalogRows[0];
    const payload = active
      ? (typeof active.payload === 'string' ? JSON.parse(active.payload) as OpsCatalogPayload : active.payload)
      : this.bootCatalog;
    const questions: OpsQuestionControl[] = questionRows.map((row) => ({
      questionId: row.question_id, version: Number(row.question_version), family: row.family, prompt: row.prompt,
      kind: row.kind, optional: row.optional, choices: row.choices, active: row.active, weight: Number(row.weight), usageCount: Number(row.usage_count),
    }));
    return { catalog: { source: active ? 'ACTIVE' : 'BOOT', version: active ? Number(active.version) : 0, payload }, questions };
  }

  async publishCatalog(payload: OpsCatalogPayload): Promise<number> {
    const rows = await this.sql.query<{ version: number }>(
      `WITH next AS (
         SELECT COALESCE(MAX(version),0)+1 AS version FROM ops_website_config_versions WHERE config_type='CATALOG'
       ), retired AS (
         UPDATE ops_website_config_versions SET status='RETIRED'
         WHERE config_type='CATALOG' AND status='ACTIVE' RETURNING id
       ), inserted AS (
         INSERT INTO ops_website_config_versions(config_type,version,status,payload,created_at,published_at)
         SELECT 'CATALOG',next.version,'ACTIVE',$1::jsonb,NOW(),NOW() FROM next
         RETURNING version
       ) SELECT version FROM inserted`,
      [JSON.stringify(payload)],
    );
    if (!rows[0]) throw new Error('Catalog could not be published');
    return Number(rows[0].version);
  }

  async updateQuestion(input: { questionId: string; version: number; active: boolean; weight: number }): Promise<void> {
    const rows = await this.sql.query<{ question_id: string }>(
      `UPDATE question_definitions AS target
       SET active=$3,weight=$4
       WHERE target.question_id=$1 AND target.question_version=$2
         AND ($3::boolean=true OR EXISTS (
           SELECT 1 FROM question_definitions AS other
           WHERE other.family=target.family AND other.active=true
             AND NOT (other.question_id=target.question_id AND other.question_version=target.question_version)
         ))
       RETURNING question_id`,
      [input.questionId, input.version, input.active, input.weight],
    );
    if (!rows[0]) throw new Error('Question update would leave its family without an active prompt or the question was not found');
  }

  async createQuestionVersion(input: { questionId: string; family: string; prompt: string; kind: 'text'|'choice'; optional: boolean; choices?: unknown }): Promise<number> {
    if (!['culture','place','rhythm','identity','music','boundary','wildcard'].includes(input.family)) throw new Error('Question family is invalid');
    const rows = await this.sql.query<{ question_version: number }>(
      `WITH current AS (
         SELECT family,COALESCE(MAX(question_version),0) AS max_version
         FROM question_definitions WHERE question_id=$1 GROUP BY family
       ), guard AS (
         SELECT COALESCE((SELECT family FROM current),$2::text) AS family,
                COALESCE((SELECT max_version FROM current),0)+1 AS version
         WHERE NOT EXISTS (SELECT 1 FROM current WHERE family<>$2::text)
       )
       INSERT INTO question_definitions(question_id,question_version,family,prompt,kind,optional,choices,active,weight,created_at)
       SELECT $1,guard.version,guard.family,$3,$4,$5,$6::jsonb,true,1,NOW() FROM guard
       RETURNING question_version`,
      [input.questionId, input.family, input.prompt, input.kind, input.optional, JSON.stringify(input.choices ?? null)],
    );
    if (!rows[0]) throw new Error('Question version could not be created or family changed');
    return Number(rows[0].question_version);
  }
}
