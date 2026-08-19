import { enqueueDesignIssue } from '@/server/design/designQueue';
import {
  createIssueService,
  IssueRuntimeUnavailableError,
} from '@/server/issues/runtimeIssues';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';
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
    const issueService = createIssueService();

    if ((result.kind === 'paid' || result.kind === 'duplicate') && result.paymentAttemptId) {
      const issue = await issueService.reserveForPaidAttempt(result.paymentAttemptId);
      await enqueueDesignIssue(issue.issue.id);
      await enqueueIssueNotification(issue.issue.id, 'PAYMENT_RECEIVED');
      return Response.json({
        received: true,
        kind: result.kind,
        issueCode: issue.issue.issueCode,
      });
    }

    if (result.kind === 'refunded' && result.paymentAttemptId) {
      await issueService.flagPaymentException(result.paymentAttemptId, 'PAYMENT_REFUNDED');
      return Response.json({ received: true, kind: result.kind });
    }

    if (result.kind === 'exception' && result.paymentAttemptId) {
      await issueService.flagPaymentException(result.paymentAttemptId, 'PAYMENT_EXCEPTION');
      return Response.json({ received: true, kind: result.kind });
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
