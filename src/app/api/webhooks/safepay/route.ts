import { dispatchPaidIssueDesign } from '@/server/design/designDispatch';
import {
  createIssueService,
  IssueRuntimeUnavailableError,
} from '@/server/issues/runtimeIssues';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';
import {
  createPaymentService,
  PaymentRuntimeUnavailableError,
} from '@/server/payments/runtimePayments';
import { enqueueReferralNotification } from '@/server/referrals/referralNotificationQueue';
import {
  createReferralConversionService,
  ReferralRuntimeUnavailableError,
  referralsAreEnabled,
} from '@/server/referrals/runtimeReferrals';

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
      if (referralsAreEnabled()) {
        const referral = await createReferralConversionService().recordPaidAttempt({
          paymentAttemptId: result.paymentAttemptId,
          issueId: issue.issue.id,
        });
        if (referral.kind !== 'not-referred') {
          await enqueueReferralNotification(referral.conversionId, 'SALE');
        }
      }
      await dispatchPaidIssueDesign(issue.issue.id);
      await enqueueIssueNotification(issue.issue.id, 'PAYMENT_RECEIVED');
      return Response.json({
        received: true,
        kind: result.kind,
        issueCode: issue.issue.issueCode,
      });
    }

    if (result.kind === 'refunded' && result.paymentAttemptId) {
      await issueService.flagPaymentException(result.paymentAttemptId, 'PAYMENT_REFUNDED');
      if (referralsAreEnabled()) {
        const referral = await createReferralConversionService().reverseRefundedAttempt(
          result.paymentAttemptId,
        );
        if (referral.kind !== 'not-referred') {
          await enqueueReferralNotification(referral.conversionId, 'REVERSAL');
        }
      }
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
      error instanceof IssueRuntimeUnavailableError ||
      error instanceof ReferralRuntimeUnavailableError
    ) {
      return Response.json({ error: 'Payment webhook is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /signature|merchant/i.test(error.message)) {
      return Response.json({ error: 'Webhook authentication failed' }, { status: 401 });
    }
    if (error instanceof Error && /webhook body|webhook data|payload|amount|timestamp/i.test(error.message)) {
      return Response.json({ error: 'Webhook payload is invalid' }, { status: 400 });
    }
    console.error('safepay webhook processing failed', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
