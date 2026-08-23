import { PostgresContactRepository } from '@/server/contact/PostgresContactRepository';
import { PreviewExperienceRepository } from '@/server/preview/PreviewExperienceRepository';
import { PreviewQuestionSetRepository } from '@/server/preview/PreviewQuestionSetRepository';
import { PreviewRepeatOrderRepository } from '@/server/preview/PreviewRepeatOrderRepository';
import { PostgresQuestionSetRepository } from '@/server/questions/PostgresQuestionSetRepository';
import { getQuestionSelectionService } from '@/server/questions/runtimeQuestions';
import { createNeonSqlExecutor } from './NeonSqlExecutor';
import { PostgresExperienceRepository } from './PostgresExperienceRepository';
import { PostgresRepeatOrderRepository } from './PostgresRepeatOrderRepository';
import { RepeatOrderService } from './RepeatOrderService';

export class RepeatOrderRuntimeUnavailableError extends Error {
  constructor(message = 'Repeat-order runtime is not configured') {
    super(message);
    this.name = 'RepeatOrderRuntimeUnavailableError';
  }
}

function questionGateway(
  repository: PreviewQuestionSetRepository | PostgresQuestionSetRepository,
) {
  const assigner = getQuestionSelectionService();
  return {
    findByExperienceId: repository.findByExperienceId.bind(repository),
    assignExcluding: assigner.assignExcluding.bind(assigner),
  };
}

export function createRepeatOrderService(): RepeatOrderService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    const questions = new PreviewQuestionSetRepository();
    return new RepeatOrderService({
      experiences: new PreviewExperienceRepository(),
      repeats: new PreviewRepeatOrderRepository(),
      questions: questionGateway(questions),
      contacts: { findVerifiedByExperienceId: async () => null },
    });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new RepeatOrderRuntimeUnavailableError('DATABASE_URL is required');
  const sql = createNeonSqlExecutor(databaseUrl);
  const questions = new PostgresQuestionSetRepository(sql);
  return new RepeatOrderService({
    experiences: new PostgresExperienceRepository(sql),
    repeats: new PostgresRepeatOrderRepository(sql),
    questions: questionGateway(questions),
    contacts: new PostgresContactRepository(sql),
  });
}
