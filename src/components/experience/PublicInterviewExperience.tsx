'use client';

import type { QuestionId } from '@/domain/experience/types';
import { InterviewFlow } from './InterviewFlow';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

async function submitAnswer(payload: AnswerPayload): Promise<void> {
  const response = await fetch('/api/experience/answer', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('The answer could not be saved.');
  }
}

export function PublicInterviewExperience() {
  return <InterviewFlow onAnswer={submitAnswer} />;
}
