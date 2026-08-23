import { QUESTIONS } from '@/domain/experience/questions';
import { nextStage } from '@/domain/experience/progress';

test('there are exactly seven semantically distinct questions', () => {
  expect(QUESTIONS).toHaveLength(7);
  expect(new Set(QUESTIONS.map((question) => question.id)).size).toBe(7);
});

test('the seven questions sound like one person talking, not a questionnaire', () => {
  expect(QUESTIONS.map((question) => question.prompt)).toEqual([
    "So tell me. What's your favourite book?",
    'Where would you disappear to for a week?',
    'Pick a time. Which one feels most like you?',
    'What do people usually get wrong about you?',
    "What's a song you never skip?",
    "What's something you'd never wear, no matter who made it?",
    'Last one. Tell me something completely random about you.',
  ]);
});

test('object selection unlocks only after q7', () => {
  expect(nextStage('QUESTION_6')).toBe('QUESTION_7');
  expect(nextStage('QUESTION_7')).toBe('PROFILE_COMPLETE');
});
