import {
  QUESTION_VAULT,
  type QuestionFamily,
} from '@/domain/questions/QuestionVault';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PreviewQuestionSetRepository } from '@/server/preview/PreviewQuestionSetRepository';
import { PostgresLiveQuestionSelectionService } from './PostgresLiveQuestionSelectionService';
import { PostgresQuestionSetRepository } from './PostgresQuestionSetRepository';
import { QuestionSelectionService } from './QuestionSelectionService';
import type { AssignedQuestionRecord } from './QuestionSetRepository';

export class QuestionAssignmentUnavailableError extends Error {
  constructor() {
    super('Persistent question assignment is not configured');
    this.name = 'QuestionAssignmentUnavailableError';
  }
}

export type QuestionAssigner = {
  assign(experienceId: string): Promise<readonly AssignedQuestionRecord[]>;
  assignExcluding(
    experienceId: string,
    excludedByFamily: Readonly<Partial<Record<QuestionFamily, string>>>,
  ): Promise<readonly AssignedQuestionRecord[]>;
};

export function getQuestionSelectionService(): QuestionAssigner {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new QuestionSelectionService(
      new PreviewQuestionSetRepository(),
      QUESTION_VAULT,
      () => 0,
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new QuestionAssignmentUnavailableError();
  const sql = createNeonSqlExecutor(databaseUrl);
  return new PostgresLiveQuestionSelectionService(
    sql,
    new PostgresQuestionSetRepository(sql),
    QUESTION_VAULT,
  );
}
