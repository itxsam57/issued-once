import type { QuestionDefinition } from './types';

export const QUESTIONS = [
  {
    id: 'q1',
    prompt: "So tell me. What's your favourite book?",
    kind: 'text',
  },
  {
    id: 'q2',
    prompt: 'Where would you disappear to for a week?',
    kind: 'text',
  },
  {
    id: 'q3',
    prompt: 'Pick a time. Which one feels most like you?',
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
    prompt: 'What do people usually get wrong about you?',
    kind: 'text',
  },
  {
    id: 'q5',
    prompt: "What's a song you never skip?",
    kind: 'text',
  },
  {
    id: 'q6',
    prompt: "What's something you'd never wear, no matter who made it?",
    kind: 'text',
  },
  {
    id: 'q7',
    prompt: 'Last one. Tell me something completely random about you.',
    kind: 'text',
    optional: true,
  },
] as const satisfies readonly QuestionDefinition[];
