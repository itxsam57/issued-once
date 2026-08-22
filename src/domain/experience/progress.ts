import type { ExperienceStage } from './types';

const NEXT_STAGE: Partial<Record<ExperienceStage, ExperienceStage>> = {
  VISITOR: 'EXPERIENCE_STARTED',
  EXPERIENCE_STARTED: 'QUESTION_1',
  QUESTION_1: 'QUESTION_2',
  QUESTION_2: 'QUESTION_3',
  QUESTION_3: 'QUESTION_4',
  QUESTION_4: 'QUESTION_5',
  QUESTION_5: 'QUESTION_6',
  QUESTION_6: 'QUESTION_7',
  QUESTION_7: 'PROFILE_COMPLETE',
  PROFILE_COMPLETE: 'OBJECT_SELECTED',
  OBJECT_SELECTED: 'SIZE_CONFIRMED',
  SIZE_CONFIRMED: 'CHECKOUT_STARTED',
};

export function nextStage(current: ExperienceStage): ExperienceStage {
  return NEXT_STAGE[current] ?? current;
}
