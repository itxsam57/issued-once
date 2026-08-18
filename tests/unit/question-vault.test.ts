import { QUESTIONS } from '@/domain/experience/questions';

const REQUIRED_FAMILIES = [
  'culture',
  'place',
  'rhythm',
  'identity',
  'music',
  'boundary',
  'wildcard',
] as const;

test('question vault contains at least eight active prompts for every design-signal family', () => {
  expect(QUESTIONS.length).toBeGreaterThanOrEqual(56);

  const records = QUESTIONS as readonly Array<{
    id: string;
    prompt: string;
    family?: string;
    active?: boolean;
  }>;

  for (const family of REQUIRED_FAMILIES) {
    const active = records.filter((question) => question.family === family && question.active !== false);
    expect(active.length, family).toBeGreaterThanOrEqual(8);
  }

  expect(new Set(records.map((question) => question.id)).size).toBe(records.length);
  expect(new Set(records.map((question) => question.prompt)).size).toBe(records.length);
});
