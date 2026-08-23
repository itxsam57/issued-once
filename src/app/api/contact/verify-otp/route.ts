import { cookies } from 'next/headers';
import { z } from 'zod';
import type { OtpVerificationErrorCode } from '@/server/contact/ContactService';
import {
  ContactRuntimeUnavailableError,
  createContactService,
} from '@/server/contact/runtimeContact';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';

const schema = z.object({
  challengeId: z.string().min(1).max(100),
  code: z.string().regex(/^\d{6}$/),
});

const OTP_CODES = new Set<OtpVerificationErrorCode>([
  'WRONG_CODE',
  'ATTEMPT_LIMIT',
  'EXPIRED',
  'USED_OR_STALE',
  'CHALLENGE_NOT_FOUND',
]);

function typedOtpFailure(error: unknown): {
  code: OtpVerificationErrorCode;
  attemptsRemaining?: number;
} | null {
  if (!(error instanceof Error) || !('code' in error)) return null;
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code !== 'string' || !OTP_CODES.has(code as OtpVerificationErrorCode)) {
    return null;
  }
  const attemptsRemaining = (error as Error & { attemptsRemaining?: unknown }).attemptsRemaining;
  return {
    code: code as OtpVerificationErrorCode,
    ...(typeof attemptsRemaining === 'number' ? { attemptsRemaining } : {}),
  };
}

function safeMessage(code: OtpVerificationErrorCode): string {
  switch (code) {
    case 'WRONG_CODE':
      return 'That code did not match.';
    case 'ATTEMPT_LIMIT':
      return 'Too many incorrect codes. Send a new code.';
    case 'EXPIRED':
      return 'That code expired. Send a new code.';
    case 'USED_OR_STALE':
    case 'CHALLENGE_NOT_FOUND':
      return 'That code is no longer active. Send a new code.';
  }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Enter the six-digit code' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    return Response.json(await createContactService().verifyOtp({
      experienceToken: token,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
    }));
  } catch (error) {
    if (error instanceof ContactRuntimeUnavailableError) {
      return Response.json({ error: 'Contact verification is unavailable' }, { status: 503 });
    }

    const otpFailure = typedOtpFailure(error);
    if (otpFailure) {
      return Response.json(
        {
          error: safeMessage(otpFailure.code),
          code: otpFailure.code,
          ...(otpFailure.attemptsRemaining !== undefined
            ? { attemptsRemaining: otpFailure.attemptsRemaining }
            : {}),
        },
        { status: otpFailure.code === 'ATTEMPT_LIMIT' ? 429 : 409 },
      );
    }

    console.error('contact otp verification failed', error);
    return Response.json({ error: 'Contact verification failed' }, { status: 500 });
  }
}
