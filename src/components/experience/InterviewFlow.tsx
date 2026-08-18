'use client';

import { useState } from 'react';
import { QUESTIONS } from '@/domain/experience/questions';
import type { QuestionDefinition, QuestionId } from '@/domain/experience/types';
import { InterviewQuestion } from './InterviewQuestion';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type InterviewFlowProps = {
  questions?: readonly QuestionDefinition[];
  initialPosition?: number;
  initiallyComplete?: boolean;
  onAnswer: (payload: AnswerPayload) => Promise<void> | void;
  onComplete?: () => Promise<void> | void;
  onProceed?: () => Promise<void> | void;
};

export function InterviewFlow({
  questions = QUESTIONS,
  initialPosition = 1,
  initiallyComplete = false,
  onAnswer,
  onComplete,
  onProceed,
}: InterviewFlowProps) {
  if (questions.length !== 7) {
    throw new Error('Interview requires exactly seven assigned questions');
  }

  const safeInitialIndex = Math.min(Math.max(initialPosition - 1, 0), questions.length - 1);
  const [questionIndex, setQuestionIndex] = useState(safeInitialIndex);
  const [complete, setComplete] = useState(initiallyComplete);

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

  const question = questions[questionIndex];

  async function handleAnswer(payload: AnswerPayload) {
    await onAnswer(payload);

    if (questionIndex === questions.length - 1) {
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
        total={questions.length}
        onAnswer={handleAnswer}
      />
    </div>
  );
}
