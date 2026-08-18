'use client';

import type { QuestionId } from '@/domain/experience/types';
import type { BaseColorOption } from './BaseColorSelection';
import type { CommitmentQuote } from './CommitmentScreen';
import { MysteryExperience } from './MysteryExperience';
import type { ObjectType } from './ObjectSelection';
import type { SizeOption } from './SizeConfirmation';

type AnswerPayload = {
  questionId: QuestionId;
  answer: string;
};

type LockedVariant = {
  object: ObjectType;
  sizeCode: string;
  colorCode: string;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('The next step could not be saved.');
  }

  return (await response.json()) as T;
}

async function submitAnswer(payload: AnswerPayload): Promise<void> {
  await postJson<{ stage: string }>('/api/experience/answer', payload);
}

async function selectObject(object: ObjectType): Promise<readonly SizeOption[]> {
  const payload = await postJson<{ sizes: SizeOption[] }>('/api/experience/object', { object });
  return payload.sizes;
}

async function confirmSize(selection: {
  object: ObjectType;
  sizeCode: string;
}): Promise<readonly BaseColorOption[]> {
  const payload = await postJson<{ colors: BaseColorOption[] }>('/api/experience/size', selection);
  return payload.colors;
}

async function confirmBase(selection: LockedVariant): Promise<CommitmentQuote> {
  return postJson<CommitmentQuote>('/api/experience/base', selection);
}

async function requestCheckout(quoteId: string): Promise<void> {
  const payload = await postJson<{ checkoutUrl: string }>('/api/checkout/start', { quoteId });
  if (!payload.checkoutUrl) {
    throw new Error('Checkout response is invalid.');
  }
  window.location.assign(payload.checkoutUrl);
}

export function PublicInterviewExperience() {
  return (
    <MysteryExperience
      onAnswer={submitAnswer}
      onObjectSelected={selectObject}
      onSizeConfirmed={confirmSize}
      onBaseColorConfirmed={confirmBase}
      onCheckoutRequested={requestCheckout}
    />
  );
}
