import { QUESTION_VAULT } from '@/domain/questions/QuestionVault';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresQuestionSetRepository } from './PostgresQuestionSetRepository';
import { QuestionSelectionService } from './QuestionSelectionService';

export class QuestionAssignmentUnavailableError extends Error {
  constructor() {
    super('Persistent question assignment is not configured');
    this.name = 'QuestionAssignmentUnavailableError';
  }
}

export function getQuestionSelectionService(): QuestionSelectionService {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new QuestionAssignmentUnavailableError();

  return new QuestionSelectionService(
    new PostgresQuestionSetRepository(createNeonSqlExecutor(databaseUrl)),
    QUESTION_VAULT,
  );
}
