import { expect, test } from 'vitest';
import { IssueService } from '@/server/issues/IssueService';
import type {
  IssueRecord,
  IssueRepository,
  PaidIssueTruth,
  ReserveIssueInput,
} from '@/server/issues/IssueRepository';

class MemoryIssueRepository implements IssueRepository {
  issues = new Map<string, IssueRecord>();
  truths = new Map<string, PaidIssueTruth>();

  async loadPaidTruth(paymentAttemptId: string) {
    return this.truths.get(paymentAttemptId) ?? null;
  }

  async findByPaymentAttemptId(paymentAttemptId: string) {
    return [...this.issues.values()].find((item) => item.paymentAttemptId === paymentAttemptId) ?? null;
  }

  async reserve(input: ReserveIssueInput) {
    const existing = await this.findByPaymentAttemptId(input.truth.paymentAttemptId);
    if (existing) return { kind: 'duplicate' as const, issue: existing };
    if ([...this.issues.values()].some((item) => item.issueCode === input.issueCode)) {
      return { kind: 'collision' as const };
    }
    const issue: IssueRecord = {
      id: input.issueId,
      issueCode: input.issueCode,
      status: 'RECEIVED',
      paymentAttemptId: input.truth.paymentAttemptId,
      experienceId: input.truth.experienceId,
      contactId: input.truth.contactId,
      shippingSnapshotId: input.truth.shippingSnapshotId,
      quoteId: input.truth.quoteId,
      productSlug: input.truth.productSlug,
      variantId: input.truth.variantId,
      objectType: input.truth.objectType,
      sizeCode: input.truth.sizeCode,
      colorCode: input.truth.colorCode,
      amountMinor: input.truth.amountMinor,
      currency: input.truth.currency,
      provider: 'SAFEPAY',
      providerReference: input.truth.providerReference,
      reservedAt: input.now,
      updatedAt: input.now,
    };
    this.issues.set(issue.id, issue);
    return { kind: 'reserved' as const, issue };
  }

  async flagPaymentException(input: {
    paymentAttemptId: string;
    reason: 'PAYMENT_REFUNDED' | 'PAYMENT_EXCEPTION';
    updatedAt: Date;
  }) {
    const issue = await this.findByPaymentAttemptId(input.paymentAttemptId);
    if (!issue) return null;
    if (['RECEIVED','BEING_INTERPRETED','DESIGN_REVIEW','DESIGN_APPROVED','MANUFACTURING_DRAFT'].includes(issue.status)) {
      issue.status = 'EXCEPTION';
    }
    issue.updatedAt = input.updatedAt;
    return { issueId: issue.id };
  }
}

const truth: PaidIssueTruth = {
  paymentAttemptId: 'pay-1',
  experienceId: 'exp-1',
  contactId: 'contact-1',
  shippingSnapshotId: 'ship-1',
  quoteId: 'quote-1',
  productSlug: 'tee',
  variantId: 'tee-m-black',
  objectType: 'tee',
  sizeCode: 'M',
  colorCode: 'Black',
  amountMinor: 5400,
  currency: 'USD',
  providerReference: 'track_paid_1',
};

function service(repository: MemoryIssueRepository) {
  return new IssueService(repository, () => 'IO-ABCD-EFGH', () => 'issue-uuid-1', () => new Date('2026-08-19T01:05:00Z'));
}

test('creates exactly one immutable Issue from server-side paid truth', async () => {
  const repository = new MemoryIssueRepository();
  repository.truths.set('pay-1', truth);

  const first = await service(repository).reserveForPaidAttempt('pay-1');
  const second = await service(repository).reserveForPaidAttempt('pay-1');

  expect(first).toMatchObject({ kind: 'reserved', issue: {
    issueCode: 'IO-ABCD-EFGH', paymentAttemptId: 'pay-1', experienceId: 'exp-1',
    contactId: 'contact-1', shippingSnapshotId: 'ship-1', objectType: 'tee', sizeCode: 'M',
    colorCode: 'Black', amountMinor: 5400, currency: 'USD', providerReference: 'track_paid_1',
  }});
  expect(second).toMatchObject({ kind: 'duplicate', issue: { id: 'issue-uuid-1' } });
  expect(repository.issues.size).toBe(1);
});

test('refuses to mint an Issue when payment/physical/shipping truth is incomplete', async () => {
  const repository = new MemoryIssueRepository();
  await expect(service(repository).reserveForPaidAttempt('missing')).rejects.toThrow(/paid.*truth|payment/i);
});

test('flags the exact Issue by immutable payment attempt when Safepay refunds it', async () => {
  const repository = new MemoryIssueRepository();
  repository.truths.set('pay-1', truth);
  await service(repository).reserveForPaidAttempt('pay-1');

  await expect(service(repository).flagPaymentException('pay-1', 'PAYMENT_REFUNDED'))
    .resolves.toEqual({ issueId: 'issue-uuid-1' });
  expect(repository.issues.get('issue-uuid-1')?.status).toBe('EXCEPTION');
});
