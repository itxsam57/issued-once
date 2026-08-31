import type { ExperienceStage, QuestionId } from '@/domain/experience/types';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
  SessionHashRotation,
} from './ExperienceRepository';

export type SqlExecutor = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<Row[]>;
};

type ExperienceRow = {
  id: string;
  public_session_hash: string;
  stage: ExperienceStage;
  hook_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  expires_at: Date | string;
};

type TransitionRow = {
  experience_id: string;
};

type RotationRow = {
  id: string;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export class PostgresExperienceRepository implements ExperienceRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: ExperienceRecord): Promise<void> {
    await this.sql.query(
      `
        INSERT INTO experiences (
          id,
          public_session_hash,
          stage,
          hook_id,
          created_at,
          updated_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        record.id,
        record.publicSessionHash,
        record.stage,
        record.hookId,
        record.createdAt,
        record.updatedAt,
        record.expiresAt,
      ],
    );
  }

  async findBySessionHash(publicSessionHash: string): Promise<ExperienceRecord | null> {
    const rows = await this.sql.query<ExperienceRow>(
      `
        SELECT
          id,
          public_session_hash,
          stage,
          hook_id,
          created_at,
          updated_at,
          expires_at
        FROM experiences
        WHERE public_session_hash = $1
          AND expires_at > NOW()
        LIMIT 1
      `,
      [publicSessionHash],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      publicSessionHash: row.public_session_hash,
      stage: row.stage,
      hookId: row.hook_id,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      expiresAt: toDate(row.expires_at),
    };
  }

  async rotateSessionHash(input: SessionHashRotation): Promise<boolean> {
    const rows = await this.sql.query<RotationRow>(
      `
        UPDATE experiences
        SET public_session_hash = $2,
            updated_at = $3
        WHERE id = $1
        RETURNING id
      `,
      [input.experienceId, input.publicSessionHash, input.updatedAt],
    );
    return rows.length === 1;
  }

  async saveAnswerAndAdvance(transition: AnswerTransition): Promise<void> {
    const { answer } = transition;
    const encrypted = answer.encryptedPayload;

    const rows = await this.sql.query<TransitionRow>(
      `
        WITH advanced AS (
          UPDATE experiences
          SET stage = $3,
              updated_at = $4
          WHERE id = $1
            AND stage = $2
            AND expires_at > NOW()
            AND NOT EXISTS (
              SELECT 1
              FROM experience_answers
              WHERE experience_id = $1
                AND question_id = $5
            )
          RETURNING id
        )
        INSERT INTO experience_answers (
          experience_id,
          question_id,
          payload_version,
          key_version,
          iv,
          auth_tag,
          ciphertext,
          answered_at
        )
        SELECT
          id,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        FROM advanced
        RETURNING experience_id
      `,
      [
        answer.experienceId,
        transition.expectedStage,
        transition.nextStage,
        transition.updatedAt,
        answer.questionId as QuestionId,
        encrypted.version,
        encrypted.keyVersion,
        encrypted.iv,
        encrypted.tag,
        encrypted.ciphertext,
        answer.answeredAt,
      ],
    );

    if (rows.length !== 1) {
      throw new Error('Experience stage conflict');
    }
  }
}
