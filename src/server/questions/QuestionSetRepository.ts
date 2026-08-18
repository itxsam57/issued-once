import type { QuestionId } from '@/domain/experience/types';
import type { QuestionFamily, VaultQuestionChoice } from '@/domain/questions/QuestionVault';

export type AssignedQuestionRecord = {
  slot: QuestionId;
  ordinal: number;
  questionId: string;
  questionVersion: number;
  family: QuestionFamily;
  prompt: string;
  kind: 'text' | 'choice';
  optional: boolean;
  choices?: readonly VaultQuestionChoice[];
};

export interface QuestionSetRepository {
  findByExperienceId(experienceId: string): Promise<readonly AssignedQuestionRecord[] | null>;
  createAssignment(input: {
    experienceId: string;
    questions: readonly AssignedQuestionRecord[];
    createdAt: Date;
  }): Promise<boolean>;
}
