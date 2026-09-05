import type { QuestionId } from '@/domain/experience/types';
import type { EncryptedPayloadV2 } from './privatePayload';

export type StoredQuizCiphertext = {
  experienceId: string;
  questionId: QuestionId;
  payloadVersion: 1;
  keyVersion: 'v1';
  iv: string;
  tag: string;
  ciphertext: string;
};

export interface QuizEncryptionRotationRepository {
  listV1(limit: number): Promise<StoredQuizCiphertext[]>;
  replaceV1(source: StoredQuizCiphertext, encrypted: EncryptedPayloadV2): Promise<boolean>;
  countV1(): Promise<number>;
}
