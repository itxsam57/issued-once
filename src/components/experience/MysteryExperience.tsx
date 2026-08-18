'use client';

import { useState } from 'react';
import type { QuestionId } from '@/domain/experience/types';
import { InterviewFlow } from './InterviewFlow';
import { ObjectSelection, type ObjectType } from './ObjectSelection';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type MysteryExperienceProps = {
  initialQuestionPosition?: number;
  onAnswer: (payload: AnswerPayload) => Promise<void> | void;
  onInterviewComplete?: () => Promise<void> | void;
  onObjectSelected: (object: ObjectType) => Promise<void> | void;
};

type ExperiencePhase = 'interview' | 'form';

export function MysteryExperience({
  initialQuestionPosition,
  onAnswer,
  onInterviewComplete,
  onObjectSelected,
}: MysteryExperienceProps) {
  const [phase, setPhase] = useState<ExperiencePhase>('interview');

  if (phase === 'form') {
    return <ObjectSelection onSelect={onObjectSelected} />;
  }

  return (
    <InterviewFlow
      initialPosition={initialQuestionPosition}
      onAnswer={onAnswer}
      onComplete={onInterviewComplete}
      onProceed={() => setPhase('form')}
    />
  );
}
