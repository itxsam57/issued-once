import type { ExperienceStage } from '@/domain/experience/types';
import type { SqlExecutor } from './PostgresExperienceRepository';
import type {
  RepeatOrderChild,
  RepeatOrderMode,
  RepeatOrderRepository,
} from './RepeatOrderRepository';

type RepeatOrderRow = {
  experience_id: string;
  stage: ExperienceStage;
  hook_id: string | null;
  created: boolean;
  answer_count: number | string;
  question_count: number | string;
  set_count: number | string;
};

function modeFromHook(hookId: string | null): RepeatOrderMode {
  if (hookId === 'repeat:reuse') return 'reuse';
  if (hookId === 'repeat:fresh') return 'fresh';
  throw new Error('Repeat order has an unexpected persisted mode');
}

export class PostgresRepeatOrderRepository implements RepeatOrderRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async resolve(input: {
    sourceExperienceId: string;
    childExperienceId: string;
    childSessionHash: string;
    requestedMode: RepeatOrderMode;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<RepeatOrderChild> {
    const rows = await this.sql.query<RepeatOrderRow>(
      `
        WITH source_valid AS (
          SELECT
            (SELECT count(*) FROM experience_answers WHERE experience_id = $1) = 7
            AND EXISTS (
              SELECT 1 FROM experience_question_sets WHERE experience_id = $1
            )
            AND (
              SELECT count(*) FROM experience_question_set_items WHERE experience_id = $1
            ) = 7 AS ok
        ), upserted AS (
          INSERT INTO experiences (
            id,
            public_session_hash,
            stage,
            hook_id,
            created_at,
            updated_at,
            expires_at
          )
          SELECT
            $2,
            $3,
            CASE WHEN $4 = 'reuse' THEN 'PROFILE_COMPLETE' ELSE 'QUESTION_1' END,
            CASE WHEN $4 = 'reuse' THEN 'repeat:reuse' ELSE 'repeat:fresh' END,
            $5,
            $5,
            $6
          FROM source_valid
          WHERE $4 = 'fresh' OR ok
          ON CONFLICT (public_session_hash) DO UPDATE
          SET public_session_hash = experiences.public_session_hash
          RETURNING id, stage, hook_id, (xmax = 0) AS created
        ), reuse_child AS (
          SELECT id, created
          FROM upserted
          WHERE hook_id = 'repeat:reuse'
        ), copied_set AS (
          INSERT INTO experience_question_sets (experience_id, created_at)
          SELECT child.id, $5
          FROM reuse_child child
          JOIN experience_question_sets source
            ON source.experience_id = $1
          ON CONFLICT (experience_id) DO NOTHING
          RETURNING experience_id
        ), copied_questions AS (
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
            child.id,
            source.ordinal,
            source.slot,
            source.question_id,
            source.question_version,
            source.family,
            source.prompt_snapshot,
            source.kind,
            source.optional,
            source.choices_snapshot
          FROM reuse_child child
          JOIN experience_question_set_items source
            ON source.experience_id = $1
          ON CONFLICT (experience_id, ordinal) DO NOTHING
          RETURNING ordinal
        ), copied_answers AS (
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
            child.id,
            source.question_id,
            source.payload_version,
            source.key_version,
            source.iv,
            source.auth_tag,
            source.ciphertext,
            source.answered_at
          FROM reuse_child child
          JOIN experience_answers source
            ON source.experience_id = $1
          ON CONFLICT (experience_id, question_id) DO NOTHING
          RETURNING question_id
        )
        SELECT
          upserted.id AS experience_id,
          upserted.stage,
          upserted.hook_id,
          upserted.created,
          CASE
            WHEN upserted.created AND upserted.hook_id = 'repeat:reuse'
              THEN (SELECT count(*) FROM copied_answers)
            ELSE 0
          END AS answer_count,
          CASE
            WHEN upserted.created AND upserted.hook_id = 'repeat:reuse'
              THEN (SELECT count(*) FROM copied_questions)
            ELSE 0
          END AS question_count,
          CASE
            WHEN upserted.created AND upserted.hook_id = 'repeat:reuse'
              THEN (SELECT count(*) FROM copied_set)
            ELSE 0
          END AS set_count
        FROM upserted
      `,
      [
        input.sourceExperienceId,
        input.childExperienceId,
        input.childSessionHash,
        input.requestedMode,
        input.createdAt,
        input.expiresAt,
      ],
    );

    const row = rows[0];
    if (!row) {
      if (input.requestedMode === 'reuse') {
        throw new Error('Repeat profile copy is incomplete');
      }
      throw new Error('Repeat order could not be created');
    }

    const mode = modeFromHook(row.hook_id);
    if (
      row.created &&
      mode === 'reuse' &&
      (Number(row.answer_count) !== 7 ||
        Number(row.question_count) !== 7 ||
        Number(row.set_count) !== 1)
    ) {
      throw new Error('Repeat profile copy is incomplete');
    }

    return {
      experienceId: row.experience_id,
      mode,
      stage: row.stage,
      created: row.created,
    };
  }
}
