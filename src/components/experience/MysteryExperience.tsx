'use client';

import { useState } from 'react';
import type { QuestionId } from '@/domain/experience/types';
import { InterviewFlow } from './InterviewFlow';
import { ObjectSelection, type ObjectType } from './ObjectSelection';
import { SizeConfirmation, type SizeOption } from './SizeConfirmation';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type SizeCatalog = Partial<Record<ObjectType, readonly SizeOption[]>>;

type MysteryExperienceProps = {
  initialQuestionPosition?: number;
  onAnswer: (payload: AnswerPayload) => Promise<void> | void;
  onInterviewComplete?: () => Promise<void> | void;
  onObjectSelected: (object: ObjectType) => Promise<void> | void;
  sizeCatalog?: SizeCatalog;
  onSizeConfirmed?: (selection: { object: ObjectType; sizeCode: string }) => Promise<void> | void;
};

type ExperiencePhase = 'interview' | 'form' | 'size';

export function MysteryExperience({
  initialQuestionPosition,
  onAnswer,
  onInterviewComplete,
  onObjectSelected,
  sizeCatalog,
  onSizeConfirmed,
}: MysteryExperienceProps) {
  const [phase, setPhase] = useState<ExperiencePhase>('interview');
  const [selectedObject, setSelectedObject] = useState<ObjectType | null>(null);

  async function handleObjectSelected(object: ObjectType) {
    await onObjectSelected(object);

    const sizes = sizeCatalog?.[object];
    if (!sizes?.length || !onSizeConfirmed) return;

    setSelectedObject(object);
    setPhase('size');
  }

  if (phase === 'size' && selectedObject) {
    const sizes = sizeCatalog?.[selectedObject] ?? [];

    return (
      <SizeConfirmation
        object={selectedObject}
        sizes={sizes}
        onConfirm={(sizeCode) => onSizeConfirmed?.({ object: selectedObject, sizeCode })}
      />
    );
  }

  if (phase === 'form') {
    return <ObjectSelection onSelect={handleObjectSelected} />;
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
