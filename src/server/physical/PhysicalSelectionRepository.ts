import type { ExperienceStage } from '@/domain/experience/types';

export type ObjectType = 'tee' | 'hoodie' | 'hat';

export type PhysicalSelectionRecord = {
  experienceId: string;
  object: ObjectType;
  productSlug: string;
  sizeCode?: string | null;
  colorCode?: string | null;
  colorLabel?: string | null;
  colorSwatch?: string | null;
  variantId?: string | null;
  updatedAt: Date;
};

export type ObjectSelectionTransition = {
  experienceId: string;
  expectedStage: ExperienceStage;
  nextStage: ExperienceStage;
  object: ObjectType;
  productSlug: string;
  updatedAt: Date;
};

export type SizeSelectionTransition = {
  experienceId: string;
  expectedStage: ExperienceStage;
  nextStage: ExperienceStage;
  sizeCode: string;
  updatedAt: Date;
};

export type BaseSelectionTransition = {
  experienceId: string;
  expectedStage: ExperienceStage;
  nextStage: ExperienceStage;
  colorCode: string;
  colorLabel: string;
  colorSwatch: string | null;
  variantId: string;
  updatedAt: Date;
};

export interface PhysicalSelectionRepository {
  selectObjectAndAdvance(transition: ObjectSelectionTransition): Promise<void>;
}

export interface SizeSelectionRepository {
  findByExperienceId(experienceId: string): Promise<PhysicalSelectionRecord | null>;
  confirmSizeAndAdvance(transition: SizeSelectionTransition): Promise<void>;
}

export interface BaseSelectionRepository {
  findByExperienceId(experienceId: string): Promise<PhysicalSelectionRecord | null>;
  confirmBaseAndAdvance(transition: BaseSelectionTransition): Promise<void>;
}
