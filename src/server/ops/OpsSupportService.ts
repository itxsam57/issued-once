import { decryptPrivatePayload, type EncryptedPayload } from '@/server/crypto/privatePayload';
import type { OpsAuditService } from './OpsAuditService';

export type OpsSupportQueueItem = {
  requestId: string;
  issueId: string;
  issueCode: string;
  issueStatus: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
  noteCount: number;
};

export interface OpsSupportStore {
  list(status: 'OPEN' | 'CLOSED' | null, limit: number): Promise<OpsSupportQueueItem[]>;
  setStatus(requestId: string, status: 'OPEN' | 'CLOSED'): Promise<{ issueId: string }>;
  addNote(issueId: string, body: string): Promise<void>;
  getReplyContext(requestId: string): Promise<{ issueId: string; issueCode: string; encryptedEmail: EncryptedPayload } | null>;
}

export interface OpsSupportReplyGateway {
  send(input: { to: string; issueCode: string; message: string; idempotencyKey: string }): Promise<{ providerMessageId: string }>;
}

export class OpsSupportService {
  constructor(
    private readonly store: OpsSupportStore,
    private readonly reply: OpsSupportReplyGateway,
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  list(status: 'OPEN' | 'CLOSED' | null, limit = 100) { return this.store.list(status, Math.min(Math.max(Math.trunc(limit), 1), 100)); }

  async setStatus(input: { requestId: string; status: 'OPEN' | 'CLOSED' }) {
    const result = await this.store.setStatus(input.requestId, input.status);
    await this.audit.record({
      actor: 'OWNER', action: input.status === 'CLOSED' ? 'SUPPORT_CLOSED' : 'SUPPORT_REOPENED', issueId: result.issueId,
      targetType: 'support_request', targetId: input.requestId, reason: null, safeMetadata: { status: input.status },
    });
  }

  async addNote(input: { issueId: string; body: string }) {
    const body = input.body.trim();
    if (!body || body.length > 10000) throw new Error('Internal note is invalid');
    await this.store.addNote(input.issueId, body);
    await this.audit.record({
      actor: 'OWNER', action: 'SUPPORT_NOTE_ADDED', issueId: input.issueId,
      targetType: 'issue_note', targetId: input.issueId, reason: null, safeMetadata: { length: body.length },
    });
  }

  async replyToCustomer(input: { requestId: string; message: string }) {
    const message = input.message.trim();
    if (message.length < 2 || message.length > 5000) throw new Error('Reply message is invalid');
    const context = await this.store.getReplyContext(input.requestId);
    if (!context) throw new Error('Support reply context is unavailable');
    const { email } = await decryptPrivatePayload<{ email: string }>(context.encryptedEmail);
    const delivered = await this.reply.send({
      to: email,
      issueCode: context.issueCode,
      message,
      idempotencyKey: `issued-once/owner-support/${input.requestId}/${Buffer.from(message).length}`,
    });
    await this.audit.record({
      actor: 'OWNER', action: 'SUPPORT_REPLY_SENT', issueId: context.issueId,
      targetType: 'support_request', targetId: input.requestId, reason: null,
      safeMetadata: { providerMessageId: delivered.providerMessageId, length: message.length },
    });
    return delivered;
  }
}
