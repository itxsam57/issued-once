import { decryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { CustomerEmailGateway } from './CustomerEmailGateway';
import type {
  NotificationEventKey,
  NotificationRepository,
} from './NotificationRepository';

function message(input: {
  eventKey: NotificationEventKey;
  issueCode: string;
  trackingUrl: string | null;
  trackingNumber: string | null;
}) {
  const prefix = `ISSUED ONCE\nISSUE / ${input.issueCode}\n\n`;
  switch (input.eventKey) {
    case 'PAYMENT_RECEIVED':
      return {
        subject: `${input.issueCode} — received`,
        text: `${prefix}We have enough.\n\nYour issue is now being interpreted. Keep this Issue Code; it is the shortest way back to your piece.`,
      };
    case 'IN_PRODUCTION':
      return {
        subject: `${input.issueCode} — in production`,
        text: `${prefix}It exists now.\n\nYour issue has entered production.`,
      };
    case 'SHIPPED': {
      const tracking = input.trackingUrl
        ? `\n\nTrack it: ${input.trackingUrl}`
        : input.trackingNumber
          ? `\n\nTracking: ${input.trackingNumber}`
          : '';
      return {
        subject: `${input.issueCode} — in transit`,
        text: `${prefix}It left us.\n\nYour issue is in transit.${tracking}`,
      };
    }
    case 'DELIVERED':
      return {
        subject: `${input.issueCode} — delivered`,
        text: `${prefix}It should be with you now.\n\nIf anything is wrong with the piece or delivery, reply to this email and include your Issue Code.`,
      };
  }
}

export class CustomerNotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly gateway: CustomerEmailGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async send(issueId: string, eventKey: NotificationEventKey): Promise<{ sent: boolean }> {
    const input = await this.repository.loadInput(issueId);
    if (!input) throw new Error('Notification input is unavailable');
    const now = this.now();
    const reserved = await this.repository.reserve(issueId, eventKey, now);
    if (!reserved) return { sent: false };

    try {
      const { email } = await decryptPrivatePayload<{ email: string }>(input.encryptedEmail);
      const content = message({
        eventKey,
        issueCode: input.issueCode,
        trackingUrl: input.trackingUrl,
        trackingNumber: input.trackingNumber,
      });
      const delivered = await this.gateway.send({
        to: email,
        subject: content.subject,
        text: content.text,
        idempotencyKey: `issued-once/issue/${issueId}/${eventKey}`,
      });
      await this.repository.markSent(issueId, eventKey, delivered.providerMessageId, this.now());
      return { sent: true };
    } catch (error) {
      await this.repository.markFailed(
        issueId,
        eventKey,
        error instanceof Error ? error.name : 'NOTIFICATION_FAILURE',
        this.now(),
      );
      throw error;
    }
  }
}
