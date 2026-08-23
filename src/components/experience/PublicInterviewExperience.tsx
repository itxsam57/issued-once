'use client';

import { useEffect, useState } from 'react';
import type { QuestionDefinition, QuestionId } from '@/domain/experience/types';
import type { ShippingAddress } from '@/server/shipping/ShippingRepository';
import type { BaseColorOption } from './BaseColorSelection';
import type {
  CommitmentQuote,
  ReferralApplicationQuote,
} from './CommitmentScreen';
import { MysteryExperience } from './MysteryExperience';
import type { ObjectType } from './ObjectSelection';
import { RepeatOrderChoice, type RepeatOrderMode } from './RepeatOrderChoice';
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

type EntryMode = 'interview' | 'profile' | 'repeat-choice' | 'form';

type BootstrapPayload = {
  stage: string;
  initialPosition: number;
  interviewComplete: boolean;
  entryMode: EntryMode;
  questions: QuestionDefinition[];
};

type ContactFailurePayload = {
  error?: string;
  code?: string;
  attemptsRemaining?: number;
};

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('The next step could not be saved.');
  }

  return (await response.json()) as T;
}

async function postContactJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as ContactFailurePayload | T | null;
  if (!response.ok) {
    const failure = (payload ?? {}) as ContactFailurePayload;
    throw Object.assign(
      new Error(typeof failure.error === 'string' ? failure.error : 'Contact verification failed.'),
      {
        ...(typeof failure.code === 'string' ? { code: failure.code } : {}),
        ...(typeof failure.attemptsRemaining === 'number'
          ? { attemptsRemaining: failure.attemptsRemaining }
          : {}),
      },
    );
  }
  if (payload === null) throw new Error('Contact verification response is invalid.');
  return payload as T;
}

function validateBootstrap(payload: BootstrapPayload): BootstrapPayload {
  if (
    (payload.entryMode === 'interview' || payload.entryMode === 'profile') &&
    payload.questions.length !== 7
  ) {
    throw new Error('Interview assignment is invalid');
  }
  if (!['interview', 'profile', 'repeat-choice', 'form'].includes(payload.entryMode)) {
    throw new Error('Experience entry mode is invalid');
  }
  return payload;
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
  const payload = await postJson<{ colors: BaseColorOption[] }>('/api/experience/size', {
    sizeCode: selection.sizeCode,
  });
  return payload.colors;
}

async function confirmBase(selection: LockedVariant): Promise<CommitmentQuote> {
  return postJson<CommitmentQuote>('/api/experience/base', {
    colorCode: selection.colorCode,
  });
}

async function checkEmail(email: string) {
  return postContactJson<{ alreadyVerified: boolean }>('/api/contact/check-email', { email });
}

async function reuseVerified(email: string) {
  return postContactJson<{ verified: true }>('/api/contact/reuse-verified', { email });
}

async function requestOtp(email: string) {
  return postContactJson<{
    challengeId: string;
    retryAfterSeconds: number;
    requestTag?: string;
  }>('/api/contact/request-otp', { email });
}

async function verifyOtp(challengeId: string, code: string) {
  return postContactJson<{ verified: true }>('/api/contact/verify-otp', {
    challengeId,
    code,
  });
}

async function saveShipping(address: ShippingAddress): Promise<void> {
  await postJson<{ saved: true }>('/api/shipping', address);
}

async function applyReferral(
  quoteId: string,
  explicitCode?: string,
): Promise<ReferralApplicationQuote> {
  return postJson<ReferralApplicationQuote>('/api/referrals/apply', {
    quoteId,
    ...(explicitCode ? { explicitCode } : {}),
  });
}

async function requestPayment(quoteId: string): Promise<void> {
  const payload = await postJson<{ checkoutUrl: string; paymentAttemptId: string }>(
    '/api/payments/create',
    { quoteId },
  );
  if (!payload.checkoutUrl) {
    throw new Error('Payment response is invalid.');
  }
  window.location.assign(payload.checkoutUrl);
}

export function PublicInterviewExperience() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);

  useEffect(() => {
    let active = true;
    void postJson<BootstrapPayload>('/api/experience/start')
      .then((payload) => {
        if (!active) return;
        setBootstrap(validateBootstrap(payload));
      })
      .catch(() => {
        if (active) setBootstrapError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  async function chooseRepeat(mode: RepeatOrderMode) {
    const next = validateBootstrap(
      await postJson<BootstrapPayload>('/api/experience/repeat', { choice: mode }),
    );
    setBootstrap(next);
  }

  if (bootstrapError) {
    return (
      <section className="interview-bootstrap" role="alert">
        <p className="interview-complete__signal">ENTRY / INTERRUPTED</p>
        <h1>Something didn&apos;t hold.</h1>
        <p>Refresh to begin again.</p>
      </section>
    );
  }

  if (!bootstrap) {
    return (
      <section className="interview-bootstrap" aria-live="polite">
        <p className="interview-complete__signal">ENTRY / 00</p>
        <h1>ISSUED ONCE</h1>
      </section>
    );
  }

  if (bootstrap.entryMode === 'repeat-choice') {
    return <RepeatOrderChoice onChoose={chooseRepeat} />;
  }

  return (
    <MysteryExperience
      questions={bootstrap.questions}
      initialQuestionPosition={bootstrap.initialPosition}
      interviewInitiallyComplete={bootstrap.interviewComplete}
      initialPhase={bootstrap.entryMode === 'form' ? 'form' : 'interview'}
      onAnswer={submitAnswer}
      onObjectSelected={selectObject}
      onSizeConfirmed={confirmSize}
      onBaseColorConfirmed={confirmBase}
      onCheckEmail={checkEmail}
      onReuseVerified={reuseVerified}
      onRequestOtp={requestOtp}
      onVerifyOtp={verifyOtp}
      onShippingSubmitted={saveShipping}
      onApplyReferral={applyReferral}
      onCheckoutRequested={requestPayment}
    />
  );
}
