import type { ExperienceStage } from '@/domain/experience/types';

export type ObjectType = 'tee' | 'hoodie' | 'hat';

export type ObjectSelectionTransition = {
  experienceId: string;
  expectedStage: ExperienceStage;
  nextStage: ExperienceStage;
  object: ObjectType;
  productSlug: string;
  updatedAt: Date;
};

export interface PhysicalSelectionRepository {
  selectObjectAndAdvance(transition: ObjectSelectionTransition): Promise<void>;
}
