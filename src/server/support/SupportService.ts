import { randomUUID } from 'node:crypto';
import { decryptPrivatePayload, encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { SupportEmailGateway } from './SupportEmailGateway';
import type { SupportRepository } from './SupportRepository';

export class SupportService {
  constructor(
    private readonly repository: SupportRepository,
    private readonly email: SupportEmailGateway,
    private readonly idGenerator: () => string = () => randomUUID(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: { sessionToken: string; message: string }) {
    const message = input.message.trim();
    if (message.length < 2 || message.length > 5000) throw new Error('Support message is invalid');
    const context = await this.repository.findContextBySessionHash(hashSessionToken(input.sessionToken));
    if (!context) throw new Error('Issue is required for support');

    const now = this.now();
    const requestId = this.idGenerator();
    await this.repository.create({
      id: requestId,
      issueId: context.issueId,
      contactId: context.contactId,
      encryptedMessage: await encryptPrivatePayload({ message }),
      createdAt: now,
      updatedAt: now,
    });

    const { email } = await decryptPrivatePayload<{ email: string }>(context.encryptedEmail);
    await this.email.send({
      issueCode: context.issueCode,
      replyTo: email,
      message,
      idempotencyKey: `issued-once/support/${requestId}`,
    });

    return { requestId, issueCode: context.issueCode };
  }

  async sendCanary(input: { releaseId: string; replyTo: string }) {
    const releaseId = input.releaseId.trim().toLowerCase();
    const replyTo = input.replyTo.trim();
    if (!/^[0-9a-f]{40}$/.test(releaseId)) throw new Error('Support canary release is invalid');
    if (!replyTo || !replyTo.includes('@')) throw new Error('Support canary reply address is invalid');

    return this.email.send({
      issueCode: `CANARY-${releaseId.slice(0, 12)}`,
      replyTo,
      message: `Automated ISSUED ONCE support delivery canary for release ${releaseId}. No customer data.`,
      idempotencyKey: `issued-once/support-canary/${releaseId}`,
    });
  }
}
