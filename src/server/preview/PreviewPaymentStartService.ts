import { hashSessionToken } from '@/server/http/sessionToken';
import { getPreviewStore } from './PreviewExperienceRepository';

export class PreviewPaymentStartService {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async start(input: {
    sessionToken: string;
    quoteId: string;
  }): Promise<{ checkoutUrl: string; paymentAttemptId: string }> {
    const store = getPreviewStore();
    const experience = store.experiences.get(hashSessionToken(input.sessionToken));
    if (!experience) throw new Error('Experience not found');
    if (experience.stage !== 'COMMITMENT_READY' && experience.stage !== 'CHECKOUT_STARTED') {
      throw new Error('Payment is not unlocked');
    }

    const quote = store.checkoutQuotes.get(input.quoteId);
    if (!quote) throw new Error('Quote not found');
    if (quote.experienceId !== experience.id) {
      throw new Error('Quote does not belong to this experience');
    }

    const now = this.now();
    if (quote.expiresAt.getTime() <= now.getTime()) throw new Error('Quote expired');

    if (experience.stage === 'COMMITMENT_READY') {
      experience.stage = 'CHECKOUT_STARTED';
      experience.updatedAt = now;
    }

    return {
      checkoutUrl: '/begin?payment=preview',
      paymentAttemptId: `preview:${experience.id}`,
    };
  }
}
