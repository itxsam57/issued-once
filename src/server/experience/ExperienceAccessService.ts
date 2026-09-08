import type { ExperienceRepository } from './ExperienceRepository';
import { createSessionToken, hashSessionToken } from '@/server/http/sessionToken';

const RESTORE_ERROR = 'Experience access could not be restored';

export class ExperienceAccessService {
  constructor(
    private readonly experiences: ExperienceRepository,
    private readonly createToken: () => string = createSessionToken,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async restore(experienceId: string): Promise<{ token: string }> {
    if (!this.experiences.rotateSessionHash) {
      throw new Error(RESTORE_ERROR);
    }

    const token = this.createToken();
    const rotated = await this.experiences.rotateSessionHash({
      experienceId,
      publicSessionHash: hashSessionToken(token),
      updatedAt: this.now(),
    });
    if (!rotated) throw new Error(RESTORE_ERROR);
    return { token };
  }

  async restoreFromCurrent(experienceId: string, currentToken: string): Promise<{ token: string }> {
    if (!currentToken || !this.experiences.rotateSessionHashIfCurrent) {
      throw new Error(RESTORE_ERROR);
    }

    const token = this.createToken();
    const rotated = await this.experiences.rotateSessionHashIfCurrent({
      experienceId,
      expectedPublicSessionHash: hashSessionToken(currentToken),
      publicSessionHash: hashSessionToken(token),
      updatedAt: this.now(),
    });
    if (!rotated) throw new Error(RESTORE_ERROR);
    return { token };
  }
}
