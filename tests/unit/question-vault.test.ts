import { QUESTION_VAULT, REQUIRED_QUESTION_FAMILIES } from '@/domain/questions/QuestionVault';

test('question vault contains at least eight active prompts for every design-signal family', () => {
  expect(QUESTION_VAULT.length).toBeGreaterThanOrEqual(56);

  for (const family of REQUIRED_QUESTION_FAMILIES) {
    const active = QUESTION_VAULT.filter(
      (question) => question.family === family && question.active,
    );
    expect(active.length, family).toBeGreaterThanOrEqual(8);
  }

  expect(new Set(QUESTION_VAULT.map((question) => question.id)).size).toBe(QUESTION_VAULT.length);
  expect(new Set(QUESTION_VAULT.map((question) => question.prompt)).size).toBe(QUESTION_VAULT.length);
});
