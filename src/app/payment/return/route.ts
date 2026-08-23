import { createPaymentService } from '@/server/payments/runtimePayments';
import { finalizePaidAttempt } from '@/server/payments/finalizePaidAttempt';

async function reconcileReturnedTracker(providerReference: string | null) {
  const tracker = providerReference?.trim();
  if (!tracker) return;

  try {
    const result = await createPaymentService().reconcileTracker({ providerReference: tracker });
    if ((result.kind === 'paid' || result.kind === 'duplicate') && result.paymentAttemptId) {
      await finalizePaidAttempt(result.paymentAttemptId);
    }
  } catch {
    // A browser return is navigation, never payment truth. Reporter/webhook recovery can retry safely.
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  await reconcileReturnedTracker(url.searchParams.get('tracker'));
  return Response.redirect(new URL('/payment/pending', request.url), 303);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const formTracker = form?.get('tracker');
  const tracker = url.searchParams.get('tracker')
    ?? (typeof formTracker === 'string' ? formTracker : null);
  await reconcileReturnedTracker(tracker);
  return Response.redirect(new URL('/payment/pending', request.url), 303);
}
