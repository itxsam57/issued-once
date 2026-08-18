'use client';

import { useState } from 'react';
import { QUESTIONS } from '@/domain/experience/questions';
import type { QuestionId } from '@/domain/experience/types';
import { InterviewQuestion } from './InterviewQuestion';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type InterviewFlowProps = {
  initialPosition?: number;
  onAnswer: (payload: AnswerPayload) => Promise<void> | void;
  onComplete?: () => Promise<void> | void;
  onProceed?: () => Promise<void> | void;
};

export function InterviewFlow({
  initialPosition = 1,
  onAnswer,
  onComplete,
  onProceed,
}: InterviewFlowProps) {
  const safeInitialIndex = Math.min(Math.max(initialPosition - 1, 0), QUESTIONS.length - 1);
  const [questionIndex, setQuestionIndex] = useState(safeInitialIndex);
  const [complete, setComplete] = useState(false);

  if (complete) {
    return (
      <section className="interview-complete" aria-live="polite">
        <p className="interview-complete__signal">PROFILE CLOSED</p>
        <h1>WE HAVE ENOUGH.</h1>
        <p>You decide what it exists on.</p>
        {onProceed ? (
          <button className="interview-complete__proceed" type="button" onClick={() => void onProceed()}>
            UNLOCK FORM
          </button>
        ) : null}
      </section>
    );
  }

  const question = QUESTIONS[questionIndex];

  async function handleAnswer(payload: AnswerPayload) {
    await onAnswer(payload);

    if (questionIndex === QUESTIONS.length - 1) {
      setComplete(true);
      await onComplete?.();
      return;
    }

    setQuestionIndex((current) => current + 1);
  }

  return (
    <div className="interview-flow">
      <InterviewQuestion
        key={question.id}
        question={question}
        position={questionIndex + 1}
        total={QUESTIONS.length}
        onAnswer={handleAnswer}
      />
    </div>
  );
}
