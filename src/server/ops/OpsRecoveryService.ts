import type { OpsAuditService } from './OpsAuditService';

export class OpsRecoveryService {
  constructor(
    private readonly actions: {
      reserveIssue(paymentAttemptId: string): Promise<{ kind: string; issue?: { id: string; issueCode: string } }>;
      enqueueDesign(issueId: string): Promise<unknown>;
      enqueuePaymentNotification(issueId: string): Promise<unknown>;
    },
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  async resumePaidIssue(paymentAttemptId: string) {
    if (!paymentAttemptId.trim()) throw new Error('Payment attempt is required');
    const result = await this.actions.reserveIssue(paymentAttemptId);
    if (!result.issue) throw new Error('Paid Issue recovery did not resolve an Issue');
    await Promise.all([
      this.actions.enqueueDesign(result.issue.id),
      this.actions.enqueuePaymentNotification(result.issue.id),
    ]);
    await this.audit.record({
      actor: 'OWNER', action: 'PAID_ISSUE_RECOVERY', issueId: result.issue.id,
      targetType: 'payment_attempt', targetId: paymentAttemptId, reason: null,
      safeMetadata: { result: result.kind, issueCode: result.issue.issueCode },
    });
    return result.issue;
  }
}
