import { decryptPrivatePayload, type EncryptedPayload } from '@/server/crypto/privatePayload';
import type { OpsAuditService } from './OpsAuditService';

export type OpsRevealCategory = 'contact' | 'shipping' | 'answers' | 'design_brief' | 'support_message';

export interface OpsPrivateSource {
  getContact(issueId: string): Promise<EncryptedPayload | null>;
  getShipping(issueId: string): Promise<EncryptedPayload | null>;
  getAnswers(issueId: string): Promise<Array<{ slot: string; prompt: string; payload: EncryptedPayload }>>;
  getDesignBrief(issueId: string): Promise<EncryptedPayload | null>;
  getSupportMessages(issueId: string): Promise<Array<{ requestId: string; status: string; payload: EncryptedPayload }>>;
}

export class OpsPrivateRevealService {
  constructor(
    private readonly source: OpsPrivateSource,
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  async reveal(input: { issueId: string; category: OpsRevealCategory; reason: string }): Promise<unknown> {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) throw new Error('A reveal reason is required');

    let value: unknown;
    switch (input.category) {
      case 'contact': {
        const encrypted = await this.source.getContact(input.issueId);
        if (!encrypted) throw new Error('Verified contact is not available');
        value = await decryptPrivatePayload<unknown>(encrypted);
        break;
      }
      case 'shipping': {
        const encrypted = await this.source.getShipping(input.issueId);
        if (!encrypted) throw new Error('Shipping data is not available');
        value = await decryptPrivatePayload<unknown>(encrypted);
        break;
      }
      case 'answers': {
        const answers = await this.source.getAnswers(input.issueId);
        if (answers.length === 0) throw new Error('Answers are not available');
        value = await Promise.all(answers.map(async (entry) => ({
          slot: entry.slot,
          prompt: entry.prompt,
          answer: (await decryptPrivatePayload<{ answer: unknown }>(entry.payload)).answer,
        })));
        break;
      }
      case 'design_brief': {
        const encrypted = await this.source.getDesignBrief(input.issueId);
        if (!encrypted) throw new Error('Private design brief is not available');
        value = await decryptPrivatePayload<unknown>(encrypted);
        break;
      }
      case 'support_message': {
        const messages = await this.source.getSupportMessages(input.issueId);
        if (messages.length === 0) throw new Error('Support messages are not available');
        value = await Promise.all(messages.map(async (entry) => ({
          requestId: entry.requestId,
          status: entry.status,
          message: await decryptPrivatePayload<unknown>(entry.payload),
        })));
        break;
      }
      default: {
        const exhaustive: never = input.category;
        throw new Error(`Unsupported reveal category: ${exhaustive}`);
      }
    }

    await this.audit.record({
      actor: 'OWNER',
      action: 'OPS_PRIVATE_REVEAL',
      issueId: input.issueId,
      targetType: 'issue_private_data',
      targetId: input.issueId,
      reason,
      safeMetadata: { category: input.category },
    });

    return value;
  }
}
