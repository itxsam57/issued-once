import type { ExperienceStage } from '@/domain/experience/types';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';

export interface CheckoutStarter {
  start(input: { quoteId: string; experienceId: string }): Promise<{ checkoutUrl: string }>;
}

export type CheckoutStateTransition = {
  experienceId: string;
  expectedStage: ExperienceStage;
  nextStage: ExperienceStage;
  updatedAt: Date;
};

export interface CheckoutStateRepository {
  advance(transition: CheckoutStateTransition): Promise<void>;
}

export class CheckoutStartService {
  constructor(
    private readonly experienceRepository: Pick<ExperienceRepository, 'findBySessionHash'>,
    private readonly checkout: CheckoutStarter,
    private readonly stateRepository: CheckoutStateRepository,
    private readonly now: () => Date = () => new Date(),
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
    if (experience.stage !== 'COMMITMENT_READY') {
      throw new Error('Checkout is not unlocked');
    }

    const result = await this.checkout.start({
      quoteId: input.quoteId,
      experienceId: experience.id,
    });

    await this.stateRepository.advance({
      experienceId: experience.id,
      expectedStage: 'COMMITMENT_READY',
      nextStage: 'CHECKOUT_STARTED',
      updatedAt: this.now(),
    });

    return result;
  }
}
