import type { QuestionId } from '@/domain/experience/types';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { EncryptedPayloadV2 } from './privatePayload';
import type {
  QuizEncryptionRotationRepository,
  StoredQuizCiphertext,
} from './QuizEncryptionRotationRepository';

type StoredQuizCiphertextRow = {
  experience_id: string;
  question_id: QuestionId;
  payload_version: number;
  key_version: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
};

type ReplacementRow = {
  experience_id: string;
};

type CountRow = {
  row_count: string | number;
};

export class PostgresQuizEncryptionRotationRepository implements QuizEncryptionRotationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async listV1(limit: number): Promise<StoredQuizCiphertext[]> {
    const rows = await this.sql.query<StoredQuizCiphertextRow>(
      `
        SELECT
          experience_id,
          question_id,
          payload_version,
          key_version,
          iv,
          auth_tag,
          ciphertext
        FROM experience_answers
        WHERE key_version = 'v1'
        ORDER BY answered_at, experience_id, question_id
        LIMIT $1
      `,
      [limit],
    );

    return rows.map((row) => {
      if (row.payload_version !== 1 || row.key_version !== 'v1') {
        throw new Error('Unexpected quiz encryption rotation row version');
      }

      return {
        experienceId: row.experience_id,
        questionId: row.question_id,
        payloadVersion: 1,
        keyVersion: 'v1',
        iv: row.iv,
        tag: row.auth_tag,
        ciphertext: row.ciphertext,
      };
    });
  }

  async replaceV1(source: StoredQuizCiphertext, encrypted: EncryptedPayloadV2): Promise<boolean> {
    const rows = await this.sql.query<ReplacementRow>(
      `
        UPDATE experience_answers
        SET payload_version = $3,
            key_version = 'v2',
            iv = $4,
            auth_tag = $5,
            ciphertext = $6
        WHERE experience_id = $1
          AND question_id = $2
          AND key_version = 'v1'
        RETURNING experience_id
      `,
      [
        source.experienceId,
        source.questionId,
        encrypted.version,
        encrypted.iv,
        encrypted.tag,
        encrypted.ciphertext,
      ],
    );

    return rows.length === 1;
  }

  async countV1(): Promise<number> {
    const rows = await this.sql.query<CountRow>(
      `
        SELECT COUNT(*) AS row_count
        FROM experience_answers
        WHERE key_version = 'v1'
      `,
    );

    const count = Number(rows[0]?.row_count ?? 0);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('Invalid V1 quiz encryption row count');
    }
    return count;
  }
}
