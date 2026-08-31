import { NextResponse } from 'next/server';
import { ExperienceAccessService } from '@/server/experience/ExperienceAccessService';
import { getExperienceRepository } from '@/server/experience/runtimeRepository';
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  sessionTokenFromCookieHeader,
} from '@/server/http/sessionCookie';
import { createPaymentService } from '@/server/payments/runtimePayments';
import { finalizePaidAttempt } from '@/server/payments/finalizePaidAttempt';

async function reconcileReturnedTracker(
  providerReference: string | null,
  currentToken: string | null,
): Promise<string | null> {
  const tracker = providerReference?.trim();
  if (!tracker) return null;

  try {
    const result = await createPaymentService().reconcileTracker({ providerReference: tracker });
    if ((result.kind === 'paid' || result.kind === 'duplicate') && result.paymentAttemptId) {
      const issue = await finalizePaidAttempt(result.paymentAttemptId);
      if (!currentToken) return null;
      const restored = await new ExperienceAccessService(getExperienceRepository()).restoreFromCurrent(
        issue.experienceId,
        currentToken,
      );
      return restored.token;
    }
  } catch {
    // Browser return is navigation, never payment or ownership truth. Reporter/webhook recovery can retry safely.
  }
  return null;
}

function paymentReturnRedirect(request: Request, restoredToken: string | null) {
  const destination = restoredToken ? '/issue' : '/payment/pending';
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  if (restoredToken) {
    response.cookies.set(SESSION_COOKIE_NAME, restoredToken, sessionCookieOptions);
  }
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentToken = sessionTokenFromCookieHeader(request.headers.get('cookie'));
  const restoredToken = await reconcileReturnedTracker(
    url.searchParams.get('tracker'),
    currentToken,
  );
  return paymentReturnRedirect(request, restoredToken);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const formTracker = form?.get('tracker');
  const tracker = url.searchParams.get('tracker')
    ?? (typeof formTracker === 'string' ? formTracker : null);
  const currentToken = sessionTokenFromCookieHeader(request.headers.get('cookie'));
  const restoredToken = await reconcileReturnedTracker(tracker, currentToken);
  return paymentReturnRedirect(request, restoredToken);
}
