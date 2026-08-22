'use client';

import { useState } from 'react';
import type { QuestionDefinition, QuestionId } from '@/domain/experience/types';
import type { ShippingAddress } from '@/server/shipping/ShippingRepository';
import { BaseColorSelection, type BaseColorOption } from './BaseColorSelection';
import {
  CommitmentScreen,
  type CommitmentQuote,
  type ReferralApplicationQuote,
} from './CommitmentScreen';
import { ContactVerification } from './ContactVerification';
import { InterviewFlow } from './InterviewFlow';
import { ObjectSelection, type ObjectType } from './ObjectSelection';
import { ShippingAddressForm } from './ShippingAddressForm';
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
  questions?: readonly QuestionDefinition[];
  initialQuestionPosition?: number;
  interviewInitiallyComplete?: boolean;
  onAnswer: (payload: AnswerPayload) => Promise<void> | void;
  onInterviewComplete?: () => Promise<void> | void;
  onObjectSelected: (object: ObjectType) => Promise<readonly SizeOption[] | void> | readonly SizeOption[] | void;
  sizeCatalog?: SizeCatalog;
  onSizeConfirmed?: (
    selection: { object: ObjectType; sizeCode: string },
  ) => Promise<readonly BaseColorOption[] | void> | readonly BaseColorOption[] | void;
  baseColorCatalog?: BaseColorCatalog;
  onBaseColorConfirmed?: (
    selection: LockedVariant,
  ) => Promise<CommitmentQuote | void> | CommitmentQuote | void;
  getCommitmentQuote?: (selection: LockedVariant) => Promise<CommitmentQuote | null>;
  onRequestOtp?: (email: string) => Promise<{ challengeId: string; retryAfterSeconds: number }>;
  onVerifyOtp?: (challengeId: string, code: string) => Promise<{ verified: true }>;
  onShippingSubmitted?: (address: ShippingAddress) => Promise<void>;
  onApplyReferral?: (
    quoteId: string,
    explicitCode?: string,
  ) => Promise<ReferralApplicationQuote>;
  onCheckoutRequested?: (quoteId: string) => Promise<void> | void;
};

type ExperiencePhase =
  | 'interview'
  | 'form'
  | 'size'
  | 'base'
  | 'contact'
  | 'shipping'
  | 'commitment';

export function MysteryExperience({
  questions,
  initialQuestionPosition,
  interviewInitiallyComplete,
  onAnswer,
  onInterviewComplete,
  onObjectSelected,
  sizeCatalog,
  onSizeConfirmed,
  baseColorCatalog,
  onBaseColorConfirmed,
  getCommitmentQuote,
  onRequestOtp,
  onVerifyOtp,
  onShippingSubmitted,
  onApplyReferral,
  onCheckoutRequested,
}: MysteryExperienceProps) {
  const [phase, setPhase] = useState<ExperiencePhase>('interview');
  const [selectedObject, setSelectedObject] = useState<ObjectType | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<{ code: string; label: string } | null>(null);
  const [availableSizes, setAvailableSizes] = useState<readonly SizeOption[]>([]);
  const [availableColors, setAvailableColors] = useState<readonly BaseColorOption[]>([]);
  const [commitmentQuote, setCommitmentQuote] = useState<CommitmentQuote | null>(null);

  const requiresContactAndShipping = Boolean(
    onRequestOtp && onVerifyOtp && onShippingSubmitted,
  );

  async function handleObjectSelected(object: ObjectType) {
    const returnedSizes = await onObjectSelected(object);
    const sizes = returnedSizes?.length ? returnedSizes : sizeCatalog?.[object];
    if (!sizes?.length || !onSizeConfirmed) return;

    setSelectedObject(object);
    setAvailableSizes(sizes);
    setPhase('size');
  }

  async function handleSizeConfirmed(sizeCode: string) {
    if (!selectedObject || !onSizeConfirmed) return;

    const returnedColors = await onSizeConfirmed({ object: selectedObject, sizeCode });
    const colors = returnedColors?.length
      ? returnedColors
      : baseColorCatalog?.[selectedObject]?.[sizeCode];
    if (!colors?.length || !onBaseColorConfirmed) return;

    setSelectedSize(sizeCode);
    setAvailableColors(colors);
    setPhase('base');
  }

  async function handleBaseColorConfirmed(colorCode: string) {
    if (!selectedObject || !selectedSize || !onBaseColorConfirmed) return;

    const selection: LockedVariant = {
      object: selectedObject,
      sizeCode: selectedSize,
      colorCode,
    };
    const returnedQuote = await onBaseColorConfirmed(selection);
    const quote = returnedQuote ?? (await getCommitmentQuote?.(selection)) ?? null;
    if (!quote || !onCheckoutRequested) return;

    const color = availableColors.find((option) => option.code === colorCode)
      ?? baseColorCatalog?.[selectedObject]?.[selectedSize]?.find(
        (option) => option.code === colorCode,
      );
    if (!color) return;

    setSelectedColor({ code: color.code, label: color.label });
    setCommitmentQuote(quote);
    setPhase(requiresContactAndShipping ? 'contact' : 'commitment');
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
        onApplyReferral={onApplyReferral}
        onCommit={onCheckoutRequested}
      />
    );
  }

  if (phase === 'shipping' && onShippingSubmitted) {
    return (
      <ShippingAddressForm
        onSubmit={async (address) => {
          await onShippingSubmitted(address);
          setPhase('commitment');
        }}
      />
    );
  }

  if (phase === 'contact' && onRequestOtp && onVerifyOtp) {
    return (
      <ContactVerification
        onRequestOtp={onRequestOtp}
        onVerifyOtp={onVerifyOtp}
        onComplete={() => setPhase('shipping')}
      />
    );
  }

  if (phase === 'base' && selectedObject && selectedSize) {
    return (
      <BaseColorSelection
        colors={availableColors}
        onConfirm={handleBaseColorConfirmed}
      />
    );
  }

  if (phase === 'size' && selectedObject) {
    return (
      <SizeConfirmation
        object={selectedObject}
        sizes={availableSizes}
        onConfirm={handleSizeConfirmed}
      />
    );
  }

  if (phase === 'form') {
    return <ObjectSelection onSelect={handleObjectSelected} />;
  }

  return (
    <InterviewFlow
      questions={questions}
      initialPosition={initialQuestionPosition}
      initiallyComplete={interviewInitiallyComplete}
      onAnswer={onAnswer}
      onComplete={onInterviewComplete}
      onProceed={() => setPhase('form')}
    />
  );
}
