import { NextResponse } from 'next/server';
import { ExperienceAccessService } from '@/server/experience/ExperienceAccessService';
import { getExperienceRepository } from '@/server/experience/runtimeRepository';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/server/http/sessionCookie';
import { createPaymentService } from '@/server/payments/runtimePayments';
import { finalizePaidAttempt } from '@/server/payments/finalizePaidAttempt';

async function reconcileReturnedTracker(providerReference: string | null): Promise<string | null> {
  const tracker = providerReference?.trim();
  if (!tracker) return null;

  try {
    const result = await createPaymentService().reconcileTracker({ providerReference: tracker });
    if ((result.kind === 'paid' || result.kind === 'duplicate') && result.paymentAttemptId) {
      const issue = await finalizePaidAttempt(result.paymentAttemptId);
      const restored = await new ExperienceAccessService(getExperienceRepository()).restore(
        issue.experienceId,
      );
      return restored.token;
    }
  } catch {
    // A browser return is navigation, never payment truth. Reporter/webhook recovery can retry safely.
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
  const restoredToken = await reconcileReturnedTracker(url.searchParams.get('tracker'));
  return paymentReturnRedirect(request, restoredToken);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const formTracker = form?.get('tracker');
  const tracker = url.searchParams.get('tracker')
    ?? (typeof formTracker === 'string' ? formTracker : null);
  const restoredToken = await reconcileReturnedTracker(tracker);
  return paymentReturnRedirect(request, restoredToken);
}
