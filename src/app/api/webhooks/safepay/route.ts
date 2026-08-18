import {
  createIssueService,
  IssueRuntimeUnavailableError,
} from '@/server/issues/runtimeIssues';
import {
  createPaymentService,
  PaymentRuntimeUnavailableError,
} from '@/server/payments/runtimePayments';

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const result = await createPaymentService().handleWebhook({
      rawBody,
      headers: request.headers,
    });

    if (result.kind === 'paid' && result.paymentAttemptId) {
      const issue = await createIssueService().reserveForPaidAttempt(result.paymentAttemptId);
      return Response.json({
        received: true,
        kind: result.kind,
        issueCode: issue.issue.issueCode,
      });
    }

    return Response.json({ received: true, kind: result.kind });
  } catch (error) {
    if (
      error instanceof PaymentRuntimeUnavailableError ||
      error instanceof IssueRuntimeUnavailableError
    ) {
      return Response.json({ error: 'Payment webhook is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /signature|merchant|webhook body|webhook data/i.test(error.message)) {
      return Response.json({ error: 'Webhook authentication failed' }, { status: 401 });
    }
    if (error instanceof Error && /payload|amount|timestamp/i.test(error.message)) {
      return Response.json({ error: 'Webhook payload is invalid' }, { status: 400 });
    }
    console.error('safepay webhook processing failed', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
