import type {
  ObjectSelectionTransition,
  PhysicalSelectionRepository,
} from '@/server/physical/PhysicalSelectionRepository';
import { getPreviewStore } from './PreviewExperienceRepository';

export class PreviewPhysicalSelectionRepository implements PhysicalSelectionRepository {
  private readonly store = getPreviewStore();

  async selectObjectAndAdvance(transition: ObjectSelectionTransition): Promise<void> {
    const record = [...this.store.experiences.values()].find(
      (candidate) => candidate.id === transition.experienceId,
    );
    if (!record) throw new Error('Experience not found');
    if (record.stage !== transition.expectedStage || record.expiresAt <= transition.updatedAt) {
      throw new Error('Physical selection stage conflict');
    }

    this.store.physicalSelections.set(transition.experienceId, {
      experienceId: transition.experienceId,
      object: transition.object,
      productSlug: transition.productSlug,
      updatedAt: transition.updatedAt,
    });
    record.stage = transition.nextStage;
    record.updatedAt = transition.updatedAt;
  }
}
