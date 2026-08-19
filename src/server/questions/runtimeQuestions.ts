import { QUESTION_VAULT } from '@/domain/questions/QuestionVault';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresLiveQuestionSelectionService } from './PostgresLiveQuestionSelectionService';
import { PostgresQuestionSetRepository } from './PostgresQuestionSetRepository';

export class QuestionAssignmentUnavailableError extends Error {
  constructor() {
    super('Persistent question assignment is not configured');
    this.name = 'QuestionAssignmentUnavailableError';
  }
}

export function getQuestionSelectionService(): PostgresLiveQuestionSelectionService {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new QuestionAssignmentUnavailableError();
  const sql = createNeonSqlExecutor(databaseUrl);
  return new PostgresLiveQuestionSelectionService(sql, new PostgresQuestionSetRepository(sql), QUESTION_VAULT);
}
