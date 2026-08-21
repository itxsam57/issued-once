import { randomUUID } from 'node:crypto';
import { decryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { CustomerEmailGateway } from '@/server/notifications/CustomerEmailGateway';
import type {
  ReferralNotificationInput,
  ReferralNotificationKind,
  ReferralRepository,
} from './ReferralRepository';

type NotificationRepository = Pick<
  ReferralRepository,
  'loadNotificationInput' | 'reserveNotification' | 'markNotificationSent' | 'markNotificationFailed'
>;

function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function validateInput(input: ReferralNotificationInput) {
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Referral notification currency is invalid');
  for (const amount of [input.rewardAmountMinor, input.pendingBalanceMinor, input.availableBalanceMinor]) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error('Referral notification balance is invalid');
    }
  }
  if (input.rewardAmountMinor <= 0) throw new Error('Referral notification reward is invalid');
}

function content(input: ReferralNotificationInput, kind: ReferralNotificationKind) {
  const balances = `Pending balance: ${money(input.pendingBalanceMinor, input.currency)}\nAvailable balance: ${money(input.availableBalanceMinor, input.currency)}`;
  if (kind === 'REVERSAL') {
    return {
      subject: 'ISSUED ONCE — referral balance adjusted',
      text: `ISSUED ONCE\n\nA referral sale was reversed.\nReward adjustment: -${money(input.rewardAmountMinor, input.currency)}\n${balances}`,
    };
  }
  return {
    subject: 'ISSUED ONCE — referral sale',
    text: `ISSUED ONCE\n\nA sale came through your referral.\nReward from this sale: ${money(input.rewardAmountMinor, input.currency)}\n${balances}`,
  };
}

export class ReferralNotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly gateway: CustomerEmailGateway,
    private readonly now: () => Date = () => new Date(),
    private readonly createDeliveryId: () => string = () => randomUUID(),
  ) {}

  async send(
    conversionId: string,
    kind: ReferralNotificationKind,
  ): Promise<{ sent: boolean }> {
    const input = await this.repository.loadNotificationInput(conversionId);
    if (!input || input.conversionId !== conversionId) {
      throw new Error('Referral notification input is unavailable');
    }
    validateInput(input);

    const at = this.now();
    const reserved = await this.repository.reserveNotification({
      id: this.createDeliveryId(),
      conversionId,
      kind,
      now: at,
    });
    if (!reserved) return { sent: false };

    try {
      const { email } = await decryptPrivatePayload<{ email: string }>(input.encryptedEmail);
      if (!email?.trim()) throw new Error('Creator email is unavailable');
      const message = content(input, kind);
      const delivered = await this.gateway.send({
        to: email.trim(),
        subject: message.subject,
        text: message.text,
        idempotencyKey: `issued-once/referral/${conversionId}/${kind}`,
      });
      await this.repository.markNotificationSent(
        conversionId,
        kind,
        delivered.providerMessageId,
        this.now(),
      );
      return { sent: true };
    } catch (error) {
      await this.repository.markNotificationFailed(
        conversionId,
        kind,
        error instanceof Error ? error.name : 'REFERRAL_NOTIFICATION_FAILURE',
        this.now(),
      );
      throw error;
    }
  }
}
