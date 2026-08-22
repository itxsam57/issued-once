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
}
