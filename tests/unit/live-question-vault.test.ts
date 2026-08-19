import { expect, test } from 'vitest';
import { PostgresLiveQuestionSelectionService } from '@/server/questions/PostgresLiveQuestionSelectionService';
import type { QuestionSetRepository } from '@/server/questions/QuestionSetRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import { QUESTION_VAULT } from '@/domain/questions/QuestionVault';

test('future assignments read active weighted Question Vault definitions from Neon', async () => {
  const assigned: unknown[] = [];
  const repository: QuestionSetRepository = {
    findByExperienceId: async () => null,
    createAssignment: async (input) => { assigned.push(...input.questions); return true; },
  };
  let call = 0;
  const sql: SqlExecutor = { query: async () => {
    call += 1;
    if (call === 1) return [] as never;
    return QUESTION_VAULT.map((question) => ({
      question_id: question.id, question_version: question.version, family: question.family, prompt: question.prompt,
      kind: question.kind, optional: question.optional, choices: question.choices ?? null, active: true,
      weight: question.family === 'culture' && question.id === QUESTION_VAULT.find((q) => q.family === 'culture')?.id ? 100 : 1,
    })) as never;
  }};
  const service = new PostgresLiveQuestionSelectionService(sql, repository, QUESTION_VAULT, () => 0);
  const result = await service.assign('experience-1');
  expect(result).toHaveLength(7);
  expect(assigned).toHaveLength(7);
});
