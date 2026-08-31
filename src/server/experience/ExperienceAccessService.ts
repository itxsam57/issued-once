import type { ExperienceRepository } from './ExperienceRepository';
import { createSessionToken, hashSessionToken } from '@/server/http/sessionToken';

export class ExperienceAccessService {
  constructor(
    private readonly experiences: ExperienceRepository,
    private readonly createToken: () => string = createSessionToken,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async restore(experienceId: string): Promise<{ token: string }> {
    const token = this.createToken();
    const rotated = await this.experiences.rotateSessionHash({
      experienceId,
      publicSessionHash: hashSessionToken(token),
      updatedAt: this.now(),
    });
    if (!rotated) throw new Error('Experience access could not be restored');
    return { token };
  }
}
