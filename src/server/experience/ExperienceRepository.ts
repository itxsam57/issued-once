import type { ExperienceStage, QuestionId } from '@/domain/experience/types';
import type { EncryptedPayload } from '@/server/crypto/privatePayload';

export type ExperienceRecord = {
  id: string;
  publicSessionHash: string;
  stage: ExperienceStage;
  hookId: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type StoredAnswer = {
  experienceId: string;
  questionId: QuestionId;
  encryptedPayload: EncryptedPayload;
  answeredAt: Date;
};

export type AnswerTransition = {
  answer: StoredAnswer;
  expectedStage: ExperienceStage;
  nextStage: ExperienceStage;
  updatedAt: Date;
};

export type SessionHashRotation = {
  experienceId: string;
  publicSessionHash: string;
  updatedAt: Date;
};

export interface ExperienceRepository {
  create(record: ExperienceRecord): Promise<void>;
  findBySessionHash(publicSessionHash: string): Promise<ExperienceRecord | null>;
  rotateSessionHash?(input: SessionHashRotation): Promise<boolean>;
  saveAnswerAndAdvance(transition: AnswerTransition): Promise<void>;
}
