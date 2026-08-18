import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';

export interface CheckoutStarter {
  start(input: { quoteId: string; experienceId: string }): Promise<{ checkoutUrl: string }>;
}

export class CheckoutStartService {
  constructor(
    private readonly experienceRepository: Pick<ExperienceRepository, 'findBySessionHash'>,
    private readonly checkout: CheckoutStarter,
  ) {}

  async start(input: {
    sessionToken: string;
    quoteId: string;
  }): Promise<{ checkoutUrl: string }> {
    const publicSessionHash = hashSessionToken(input.sessionToken);
    const experience = await this.experienceRepository.findBySessionHash(publicSessionHash);
    if (!experience) {
      throw new Error('Experience not found');
    }

    return this.checkout.start({
      quoteId: input.quoteId,
      experienceId: experience.id,
    });
  }
}
