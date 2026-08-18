import { QUESTIONS } from '@/domain/experience/questions';
import { nextStage } from '@/domain/experience/progress';

test('there are exactly seven semantically distinct questions', () => {
  expect(QUESTIONS).toHaveLength(7);
  expect(new Set(QUESTIONS.map((question) => question.id)).size).toBe(7);
});

test('object selection unlocks only after q7', () => {
  expect(nextStage('QUESTION_6')).toBe('QUESTION_7');
  expect(nextStage('QUESTION_7')).toBe('PROFILE_COMPLETE');
});
