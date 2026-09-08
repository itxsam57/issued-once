import { IssueRuntimeUnavailableError } from '@/server/issues/runtimeIssues';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsRefundService } from '@/server/ops/runtimeOwnerOs';
import { OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';
import { PaymentRuntimeUnavailableError } from '@/server/payments/runtimePayments';
import { ReferralRuntimeUnavailableError } from '@/server/referrals/runtimeReferrals';

export async function POST(
  request: Request,
  context: { params: Promise<{ issueId: string }> },
) {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { issueId } = await context.params;
    const body = await request.json().catch(() => null) as { confirmation?: string } | null;
    if (!body?.confirmation?.trim()) {
      return Response.json({ error: 'Confirmation is required' }, { status: 400 });
    }

    const result = await createOpsRefundService().reconcile({
      issueId,
      confirmation: body.confirmation,
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (
      error instanceof OpsRuntimeUnavailableError ||
      error instanceof PaymentRuntimeUnavailableError ||
      error instanceof IssueRuntimeUnavailableError ||
      error instanceof ReferralRuntimeUnavailableError
    ) {
      return Response.json({ error: 'Refund reconciliation is unavailable' }, { status: 503 });
    }

    const message = error instanceof Error ? error.message : 'Refund reconciliation failed';
    if (/Issue not found|VERIFY SAFEPAY|Safepay payment reference|must be paid or refunded/i.test(message)) {
      return Response.json({ error: message }, { status: 400 });
    }
    if (/Safepay refund could not be reconciled/i.test(message)) {
      return Response.json({ error: message }, { status: 409 });
    }

    console.error('refund reconciliation failed');
    return Response.json({ error: 'Refund reconciliation failed' }, { status: 500 });
  }
}
