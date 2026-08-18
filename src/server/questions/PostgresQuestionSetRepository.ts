import type { QuestionFamily, VaultQuestionChoice } from '@/domain/questions/QuestionVault';
import type { QuestionId } from '@/domain/experience/types';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { AssignedQuestionRecord, QuestionSetRepository } from './QuestionSetRepository';

type AssignmentRow = {
  slot: QuestionId;
  ordinal: number;
  question_id: string;
  question_version: number;
  family: QuestionFamily;
  prompt_snapshot: string;
  kind: 'text' | 'choice';
  optional: boolean;
  choices_snapshot: readonly VaultQuestionChoice[] | null;
};

type CreatedRow = { created: boolean };

export class PostgresQuestionSetRepository implements QuestionSetRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByExperienceId(experienceId: string): Promise<readonly AssignedQuestionRecord[] | null> {
    const rows = await this.sql.query<AssignmentRow>(
      `SELECT
         slot,
         ordinal,
         question_id,
         question_version,
         family,
         prompt_snapshot,
         kind,
         optional,
         choices_snapshot
       FROM experience_question_set_items
       WHERE experience_id = $1
       ORDER BY ordinal ASC`,
      [experienceId],
    );

    if (!rows.length) return null;
    if (rows.length !== 7) throw new Error('Stored question assignment is incomplete');

    return rows.map((row) => ({
      slot: row.slot,
      ordinal: Number(row.ordinal),
      questionId: row.question_id,
      questionVersion: Number(row.question_version),
      family: row.family,
      prompt: row.prompt_snapshot,
      kind: row.kind,
      optional: row.optional,
      choices: row.choices_snapshot ?? undefined,
    }));
  }

  async createAssignment(input: {
    experienceId: string;
    questions: readonly AssignedQuestionRecord[];
    createdAt: Date;
  }): Promise<boolean> {
    if (input.questions.length !== 7) throw new Error('Exactly seven questions are required');

    const payload = input.questions.map((question) => ({
      slot: question.slot,
      ordinal: question.ordinal,
      questionId: question.questionId,
      questionVersion: question.questionVersion,
      family: question.family,
      prompt: question.prompt,
      kind: question.kind,
      optional: question.optional,
      choices: question.choices ?? null,
    }));
    const serialized = JSON.stringify(payload);

    await this.sql.query(
      `INSERT INTO question_definitions (
         question_id,
         question_version,
         family,
         prompt,
         kind,
         optional,
         choices,
         active,
         weight,
         created_at
       )
       SELECT
         "questionId",
         "questionVersion",
         family,
         prompt,
         kind,
         optional,
         choices,
         true,
         1,
         $2
       FROM jsonb_to_recordset($1::jsonb) AS q(
         slot text,
         ordinal integer,
         "questionId" text,
         "questionVersion" integer,
         family text,
         prompt text,
         kind text,
         optional boolean,
         choices jsonb
       )
       ON CONFLICT (question_id, question_version) DO NOTHING`,
      [serialized, input.createdAt],
    );

    const rows = await this.sql.query<CreatedRow>(
      `WITH inserted_set AS (
         INSERT INTO experience_question_sets (experience_id, created_at)
         VALUES ($1, $3)
         ON CONFLICT (experience_id) DO NOTHING
         RETURNING experience_id
       ), supplied AS (
         SELECT *
         FROM jsonb_to_recordset($2::jsonb) AS q(
           slot text,
           ordinal integer,
           "questionId" text,
           "questionVersion" integer,
           family text,
           prompt text,
           kind text,
           optional boolean,
           choices jsonb
         )
       ), inserted_items AS (
         INSERT INTO experience_question_set_items (
           experience_id,
           ordinal,
           slot,
           question_id,
           question_version,
           family,
           prompt_snapshot,
           kind,
           optional,
           choices_snapshot
         )
         SELECT
           $1,
           ordinal,
           slot,
           "questionId",
           "questionVersion",
           family,
           prompt,
           kind,
           optional,
           choices
         FROM supplied
         WHERE EXISTS (SELECT 1 FROM inserted_set)
         ORDER BY ordinal
         RETURNING ordinal
       )
       SELECT (SELECT count(*) FROM inserted_items) = 7 AS created`,
      [input.experienceId, serialized, input.createdAt],
    );

    return rows[0]?.created === true;
  }
}
