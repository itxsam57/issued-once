'use client';

import { useState } from 'react';
import type { QuestionId } from '@/domain/experience/types';
import { BaseColorSelection, type BaseColorOption } from './BaseColorSelection';
import { CommitmentScreen, type CommitmentQuote } from './CommitmentScreen';
import { InterviewFlow } from './InterviewFlow';
import { ObjectSelection, type ObjectType } from './ObjectSelection';
import { SizeConfirmation, type SizeOption } from './SizeConfirmation';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type LockedVariant = {
  object: ObjectType;
  sizeCode: string;
  colorCode: string;
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
  onBaseColorConfirmed?: (selection: LockedVariant) => Promise<void> | void;
  getCommitmentQuote?: (selection: LockedVariant) => Promise<CommitmentQuote | null>;
  onCheckoutRequested?: (quoteId: string) => Promise<void> | void;
};

type ExperiencePhase = 'interview' | 'form' | 'size' | 'base' | 'commitment';

export function MysteryExperience({
  initialQuestionPosition,
  onAnswer,
  onInterviewComplete,
  onObjectSelected,
  sizeCatalog,
  onSizeConfirmed,
  baseColorCatalog,
  onBaseColorConfirmed,
  getCommitmentQuote,
  onCheckoutRequested,
}: MysteryExperienceProps) {
  const [phase, setPhase] = useState<ExperiencePhase>('interview');
  const [selectedObject, setSelectedObject] = useState<ObjectType | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<{ code: string; label: string } | null>(null);
  const [commitmentQuote, setCommitmentQuote] = useState<CommitmentQuote | null>(null);

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

  async function handleBaseColorConfirmed(colorCode: string) {
    if (!selectedObject || !selectedSize || !onBaseColorConfirmed) return;

    const selection: LockedVariant = {
      object: selectedObject,
      sizeCode: selectedSize,
      colorCode,
    };
    await onBaseColorConfirmed(selection);

    if (!getCommitmentQuote || !onCheckoutRequested) return;

    const quote = await getCommitmentQuote(selection);
    if (!quote) return;

    const color = baseColorCatalog?.[selectedObject]?.[selectedSize]?.find(
      (option) => option.code === colorCode,
    );
    if (!color) return;

    setSelectedColor({ code: color.code, label: color.label });
    setCommitmentQuote(quote);
    setPhase('commitment');
  }

  if (
    phase === 'commitment' &&
    selectedObject &&
    selectedSize &&
    selectedColor &&
    commitmentQuote &&
    onCheckoutRequested
  ) {
    return (
      <CommitmentScreen
        selection={{
          object: selectedObject,
          sizeCode: selectedSize,
          colorLabel: selectedColor.label,
        }}
        quote={commitmentQuote}
        onCommit={onCheckoutRequested}
      />
    );
  }

  if (phase === 'base' && selectedObject && selectedSize) {
    const colors = baseColorCatalog?.[selectedObject]?.[selectedSize] ?? [];

    return (
      <BaseColorSelection
        colors={colors}
        onConfirm={handleBaseColorConfirmed}
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
