import { randomUUID } from 'node:crypto';
import { generateIssueCode } from './IssueCode';
import type { IssueRepository } from './IssueRepository';

const ISSUE_CODE_ATTEMPTS = 5;

export class IssueService {
  constructor(
    private readonly repository: IssueRepository,
    private readonly codeGenerator: () => string = () => generateIssueCode(),
    private readonly idGenerator: () => string = () => randomUUID(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async reserveForPaidAttempt(paymentAttemptId: string) {
    const existing = await this.repository.findByPaymentAttemptId(paymentAttemptId);
    if (existing) return { kind: 'duplicate' as const, issue: existing };

    const truth = await this.repository.loadPaidTruth(paymentAttemptId);
    if (!truth) throw new Error('Paid payment truth is incomplete or unavailable');
    if (
      !truth.experienceId || !truth.contactId || !truth.shippingSnapshotId || !truth.quoteId ||
      !truth.productSlug || !truth.variantId || !truth.objectType || !truth.sizeCode || !truth.colorCode ||
      !truth.providerReference || !Number.isSafeInteger(truth.amountMinor) || truth.amountMinor <= 0 ||
      !/^[A-Z]{3}$/.test(truth.currency)
    ) {
      throw new Error('Paid payment truth is incomplete or unavailable');
    }

    const issueId = this.idGenerator();
    for (let attempt = 0; attempt < ISSUE_CODE_ATTEMPTS; attempt += 1) {
      const result = await this.repository.reserve({
        issueId,
        issueCode: this.codeGenerator(),
        truth,
        now: this.now(),
      });
      if (result.kind !== 'collision') return result;
    }

    throw new Error('Issue code collision budget exhausted');
  }
}
