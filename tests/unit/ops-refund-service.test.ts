import { beforeEach, expect, test, vi } from 'vitest';
import { OpsRefundService } from '@/server/ops/OpsRefundService';

const issue = {
  issueId: '11111111-1111-4111-8111-111111111111',
  issueCode: 'IO-ABCD-EFGH',
  paymentStatus: 'PAID',
  paymentProvider: 'SAFEPAY',
  paymentProviderReference: 'track_refund_123',
};

const getIssueDetail = vi.fn();
const reconcileRefund = vi.fn();
const finalizeRefundedAttempt = vi.fn();
const recordAudit = vi.fn();

function service() {
  return new OpsRefundService(
    { getIssueDetail },
    { reconcileRefund },
    finalizeRefundedAttempt,
    { record: recordAudit },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getIssueDetail.mockResolvedValue(issue);
  reconcileRefund.mockResolvedValue({ kind: 'pending', paymentAttemptId: 'attempt-1' });
  finalizeRefundedAttempt.mockResolvedValue(undefined);
  recordAudit.mockResolvedValue(undefined);
});

test('requires the exact Issue Code verification phrase before consulting Safepay truth', async () => {
  await expect(service().reconcile({
    issueId: issue.issueId,
    confirmation: 'VERIFY SAFEPAY SOMETHING-ELSE',
  })).rejects.toThrow(/VERIFY SAFEPAY IO-ABCD-EFGH/);

  expect(reconcileRefund).not.toHaveBeenCalled();
  expect(finalizeRefundedAttempt).not.toHaveBeenCalled();
});

test('uses only the stored Safepay reference and leaves local state untouched while provider truth is pending', async () => {
  await expect(service().reconcile({
    issueId: issue.issueId,
    confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH',
  })).resolves.toEqual({ kind: 'pending', issueCode: 'IO-ABCD-EFGH' });

  expect(reconcileRefund).toHaveBeenCalledWith({ providerReference: 'track_refund_123' });
  expect(finalizeRefundedAttempt).not.toHaveBeenCalled();
  expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
    actor: 'OWNER',
    action: 'PAYMENT_REFUND_RECONCILIATION_CHECK',
    issueId: issue.issueId,
    safeMetadata: expect.objectContaining({ outcome: 'pending', issueCode: issue.issueCode }),
  }));
});

test('finalizes the existing refund lifecycle only after provider-derived reconciliation confirms REFUNDED', async () => {
  reconcileRefund.mockResolvedValue({ kind: 'refunded', paymentAttemptId: 'attempt-1' });

  await expect(service().reconcile({
    issueId: issue.issueId,
    confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH',
  })).resolves.toEqual({ kind: 'refunded', issueCode: 'IO-ABCD-EFGH' });

  expect(finalizeRefundedAttempt).toHaveBeenCalledWith('attempt-1');
  expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
    actor: 'OWNER',
    action: 'PAYMENT_REFUND_RECONCILIATION_CHECK',
    targetType: 'payment_attempt',
    targetId: 'attempt-1',
    safeMetadata: expect.objectContaining({ outcome: 'refunded', issueCode: issue.issueCode }),
  }));
});

test('fails closed for non-Safepay or non-paid Issues', async () => {
  getIssueDetail.mockResolvedValueOnce({ ...issue, paymentProvider: 'OTHER' });
  await expect(service().reconcile({ issueId: issue.issueId, confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH' }))
    .rejects.toThrow(/Safepay/i);

  getIssueDetail.mockResolvedValueOnce({ ...issue, paymentStatus: 'FAILED' });
  await expect(service().reconcile({ issueId: issue.issueId, confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH' }))
    .rejects.toThrow(/paid|refunded/i);

  expect(reconcileRefund).not.toHaveBeenCalled();
});
