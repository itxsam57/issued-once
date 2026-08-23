import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresQuizEncryptionRotationRepository } from './PostgresQuizEncryptionRotationRepository';
import { QuizEncryptionRotationService } from './QuizEncryptionRotationService';

export function createQuizEncryptionRotationService(): QuizEncryptionRotationService {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Quiz encryption rotation database is not configured');
  }

  return new QuizEncryptionRotationService(
    new PostgresQuizEncryptionRotationRepository(createNeonSqlExecutor(databaseUrl)),
  );
}
