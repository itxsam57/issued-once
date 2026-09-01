import type { OpsAuditService } from './OpsAuditService';

type RefundIssue = {
  issueId: string;
  issueCode: string;
  paymentStatus: string | null;
  paymentProvider: string | null;
  paymentProviderReference: string | null;
};

type RefundTruthResult = {
  kind: string;
  paymentAttemptId?: string;
};

export class OpsRefundService {
  constructor(
    private readonly issues: {
      getIssueDetail(issueId: string): Promise<RefundIssue | null>;
    },
    private readonly payments: {
      reconcileRefund(input: { providerReference: string }): Promise<RefundTruthResult>;
    },
    private readonly finalizeRefundedAttempt: (paymentAttemptId: string) => Promise<void>,
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  async reconcile(input: { issueId: string; confirmation: string }) {
    const issue = await this.issues.getIssueDetail(input.issueId);
    if (!issue) throw new Error('Issue not found');

    const expectedConfirmation = `VERIFY SAFEPAY ${issue.issueCode}`;
    if (input.confirmation.trim() !== expectedConfirmation) {
      throw new Error(`Type ${expectedConfirmation} to reconcile Safepay truth`);
    }

    const providerReference = issue.paymentProviderReference?.trim() ?? '';
    if (issue.paymentProvider !== 'SAFEPAY' || !providerReference.startsWith('track_')) {
      throw new Error('Safepay payment reference is not available');
    }
    if (issue.paymentStatus !== 'PAID' && issue.paymentStatus !== 'REFUNDED') {
      throw new Error('Payment must be paid or refunded before Safepay refund reconciliation');
    }

    const result = await this.payments.reconcileRefund({ providerReference });
    if (result.kind === 'pending') {
      await this.audit.record({
        actor: 'OWNER',
        action: 'PAYMENT_REFUND_RECONCILIATION_CHECK',
        issueId: issue.issueId,
        targetType: 'issue',
        targetId: issue.issueId,
        reason: null,
        safeMetadata: { outcome: 'pending', issueCode: issue.issueCode },
      });
      return { kind: 'pending' as const, issueCode: issue.issueCode };
    }

    if (result.kind !== 'refunded' || !result.paymentAttemptId) {
      throw new Error('Safepay refund could not be reconciled');
    }

    await this.finalizeRefundedAttempt(result.paymentAttemptId);
    await this.audit.record({
      actor: 'OWNER',
      action: 'PAYMENT_REFUND_RECONCILIATION_CHECK',
      issueId: issue.issueId,
      targetType: 'payment_attempt',
      targetId: result.paymentAttemptId,
      reason: null,
      safeMetadata: { outcome: 'refunded', issueCode: issue.issueCode },
    });
    return { kind: 'refunded' as const, issueCode: issue.issueCode };
  }
}
