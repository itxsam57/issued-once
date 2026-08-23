import type { ExperienceStage } from '@/domain/experience/types';

export type RepeatOrderMode = 'reuse' | 'fresh';

export type RepeatOrderChild = {
  experienceId: string;
  mode: RepeatOrderMode;
  stage: ExperienceStage;
  created: boolean;
};

export interface RepeatOrderRepository {
  resolve(input: {
    sourceExperienceId: string;
    childExperienceId: string;
    childSessionHash: string;
    requestedMode: RepeatOrderMode;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<RepeatOrderChild>;
}
