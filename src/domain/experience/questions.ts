import type { QuestionDefinition } from './types';

export const QUESTIONS = [
  {
    id: 'q1',
    prompt: 'Name three things you can talk about for hours.',
    kind: 'text',
  },
  {
    id: 'q2',
    prompt: 'Where would you disappear for a week if nobody could contact you?',
    kind: 'text',
  },
  {
    id: 'q3',
    prompt: 'Pick a time that feels most like you.',
    kind: 'choice',
    choices: [
      { value: 'sunrise', label: 'Sunrise' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'midnight', label: 'Midnight' },
      { value: '4am', label: '4 a.m.' },
    ],
  },
  {
    id: 'q4',
    prompt: 'What is something people usually misunderstand about you?',
    kind: 'text',
  },
  {
    id: 'q5',
    prompt: 'Name a song, film, person, team, game or character that carries your kind of energy.',
    kind: 'text',
  },
  {
    id: 'q6',
    prompt: 'What must never appear on something you wear?',
    kind: 'text',
  },
  {
    id: 'q7',
    prompt: 'Give me one completely random fact about yourself.',
    kind: 'text',
    optional: true,
  },
] as const satisfies readonly QuestionDefinition[];
