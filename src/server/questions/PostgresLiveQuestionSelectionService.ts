import type {
  QuestionFamily,
  VaultQuestionChoice,
  VaultQuestionDefinition,
} from '@/domain/questions/QuestionVault';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { AssignedQuestionRecord, QuestionSetRepository } from './QuestionSetRepository';
import { QuestionSelectionService } from './QuestionSelectionService';

type Row = {
  question_id: string;
  question_version: number;
  family: QuestionFamily;
  prompt: string;
  kind: 'text' | 'choice';
  optional: boolean;
  choices: readonly VaultQuestionChoice[] | null;
  active: boolean;
  weight: number | string;
};

type ExcludedByFamily = Readonly<Partial<Record<QuestionFamily, string>>>;

export class PostgresLiveQuestionSelectionService {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly repository: QuestionSetRepository,
    private readonly seedVault: readonly VaultQuestionDefinition[],
    private readonly random: () => number = Math.random,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async assign(experienceId: string): Promise<readonly AssignedQuestionRecord[]> {
    const existing = await this.repository.findByExperienceId(experienceId);
    if (existing) return existing;

    const service = await this.createSelectionService();
    return service.assign(experienceId);
  }

  async assignExcluding(
    experienceId: string,
    excludedByFamily: ExcludedByFamily,
  ): Promise<readonly AssignedQuestionRecord[]> {
    const existing = await this.repository.findByExperienceId(experienceId);
    if (existing) return existing;

    const service = await this.createSelectionService();
    return service.assignExcluding(experienceId, excludedByFamily);
  }

  private async createSelectionService(): Promise<QuestionSelectionService> {
    const createdAt = this.now();
    await this.sql.query(
      `INSERT INTO question_definitions (
        question_id,question_version,family,prompt,kind,optional,choices,active,weight,created_at
       )
       SELECT "id","version",family,prompt,kind,optional,choices,true,weight,$2
       FROM jsonb_to_recordset($1::jsonb) AS q(
         "id" text,"version" integer,family text,prompt text,kind text,optional boolean,choices jsonb,weight double precision
       )
       ON CONFLICT (question_id,question_version) DO NOTHING`,
      [
        JSON.stringify(
          this.seedVault.map((question) => ({
            ...question,
            choices: question.choices ?? null,
          })),
        ),
        createdAt,
      ],
    );

    const rows = await this.sql.query<Row>(
      `SELECT question_id,question_version,family,prompt,kind,optional,choices,active,weight
       FROM question_definitions
       WHERE active=true AND weight>0
       ORDER BY family,question_id,question_version`,
    );
    const vault: VaultQuestionDefinition[] = rows.map((row) => ({
      id: row.question_id,
      version: Number(row.question_version),
      family: row.family,
      prompt: row.prompt,
      kind: row.kind,
      optional: row.optional,
      choices: row.choices ?? undefined,
      active: row.active,
      weight: Number(row.weight),
    }));

    return new QuestionSelectionService(
      this.repository,
      vault,
      this.random,
      this.now,
    );
  }
}
