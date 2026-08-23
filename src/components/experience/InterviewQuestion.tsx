'use client';

import { useState } from 'react';
import type { QuestionDefinition, QuestionId } from '@/domain/experience/types';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type InterviewQuestionProps = {
  question: QuestionDefinition;
  position: number;
  total: number;
  onAnswer: (payload: AnswerPayload) => Promise<void> | void;
};

function progressLabel(position: number, total: number): string {
  return `${String(position).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

export function InterviewQuestion({
  question,
  position,
  total,
  onAnswer,
}: InterviewQuestionProps) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canContinue = question.optional || answer.trim().length > 0;

  async function submit() {
    if (!canContinue || submitting) return;

    setSubmitting(true);
    setSaveError(null);
    try {
      await onAnswer({ questionId: question.id, answer: answer.trim() });
    } catch {
      setSaveError('NOT SAVED / TRY AGAIN');
    } finally {
      setSubmitting(false);
    }
  }

  function updateAnswer(value: string) {
    setAnswer(value);
    if (saveError) setSaveError(null);
  }

  return (
    <section className="interview-question ph-no-capture" aria-labelledby={`question-${question.id}`}>
      <div className="interview-question__meta" aria-label={`Question ${position} of ${total}`}>
        <span>{progressLabel(position, total)}</span>
      </div>

      <h1 id={`question-${question.id}`}>{question.prompt}</h1>

      {question.kind === 'choice' && question.choices ? (
        <fieldset className="interview-question__choices">
          <legend className="sr-only">Your answer</legend>
          {question.choices.map((choice) => (
            <label key={choice.value} className="interview-question__choice">
              <input
                className="ph-no-capture"
                type="radio"
                name={question.id}
                value={choice.value}
                checked={answer === choice.value}
                onChange={(event) => updateAnswer(event.target.value)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="interview-question__answer">
          <span className="sr-only">Your answer</span>
          <textarea
            className="ph-no-capture"
            aria-label="Your answer"
            value={answer}
            onChange={(event) => updateAnswer(event.target.value)}
            rows={3}
            autoComplete="off"
            spellCheck="true"
          />
        </label>
      )}

      {saveError ? (
        <p className="interview-question__save-state" role="status">
          {saveError}
        </p>
      ) : null}

      <button type="button" onClick={submit} disabled={!canContinue || submitting}>
        {submitting ? '...' : 'CONTINUE'}
      </button>
    </section>
  );
}
