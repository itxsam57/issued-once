'use client';

import { useState } from 'react';
import type { QuestionId } from '@/domain/experience/types';
import { BaseColorSelection, type BaseColorOption } from './BaseColorSelection';
import { InterviewFlow } from './InterviewFlow';
import { ObjectSelection, type ObjectType } from './ObjectSelection';
import { SizeConfirmation, type SizeOption } from './SizeConfirmation';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type SizeCatalog = Partial<Record<ObjectType, readonly SizeOption[]>>;
type BaseColorCatalog = Partial<
  Record<ObjectType, Readonly<Record<string, readonly BaseColorOption[]>>>
>;

type MysteryExperienceProps = {
  initialQuestionPosition?: number;
  onAnswer: (payload: AnswerPayload) => Promise<void> | void;
  onInterviewComplete?: () => Promise<void> | void;
  onObjectSelected: (object: ObjectType) => Promise<void> | void;
  sizeCatalog?: SizeCatalog;
  onSizeConfirmed?: (selection: { object: ObjectType; sizeCode: string }) => Promise<void> | void;
  baseColorCatalog?: BaseColorCatalog;
  onBaseColorConfirmed?: (selection: {
    object: ObjectType;
    sizeCode: string;
    colorCode: string;
  }) => Promise<void> | void;
};

type ExperiencePhase = 'interview' | 'form' | 'size' | 'base';

export function MysteryExperience({
  initialQuestionPosition,
  onAnswer,
  onInterviewComplete,
  onObjectSelected,
  sizeCatalog,
  onSizeConfirmed,
  baseColorCatalog,
  onBaseColorConfirmed,
}: MysteryExperienceProps) {
  const [phase, setPhase] = useState<ExperiencePhase>('interview');
  const [selectedObject, setSelectedObject] = useState<ObjectType | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  async function handleObjectSelected(object: ObjectType) {
    await onObjectSelected(object);

    const sizes = sizeCatalog?.[object];
    if (!sizes?.length || !onSizeConfirmed) return;

    setSelectedObject(object);
    setPhase('size');
  }

  async function handleSizeConfirmed(sizeCode: string) {
    if (!selectedObject || !onSizeConfirmed) return;

    await onSizeConfirmed({ object: selectedObject, sizeCode });

    const colors = baseColorCatalog?.[selectedObject]?.[sizeCode];
    if (!colors?.length || !onBaseColorConfirmed) return;

    setSelectedSize(sizeCode);
    setPhase('base');
  }

  if (phase === 'base' && selectedObject && selectedSize) {
    const colors = baseColorCatalog?.[selectedObject]?.[selectedSize] ?? [];

    return (
      <BaseColorSelection
        colors={colors}
        onConfirm={(colorCode) =>
          onBaseColorConfirmed?.({
            object: selectedObject,
            sizeCode: selectedSize,
            colorCode,
          })
        }
      />
    );
  }

  if (phase === 'size' && selectedObject) {
    const sizes = sizeCatalog?.[selectedObject] ?? [];

    return (
      <SizeConfirmation
        object={selectedObject}
        sizes={sizes}
        onConfirm={handleSizeConfirmed}
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
