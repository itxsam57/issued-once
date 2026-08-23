import type {
  BaseSelectionRepository,
  BaseSelectionTransition,
  ObjectSelectionTransition,
  PhysicalSelectionRecord,
  PhysicalSelectionRepository,
  SizeSelectionRepository,
  SizeSelectionTransition,
} from '@/server/physical/PhysicalSelectionRepository';
import { getPreviewStore } from './PreviewExperienceRepository';

export class PreviewPhysicalSelectionRepository
  implements PhysicalSelectionRepository, SizeSelectionRepository, BaseSelectionRepository
{
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

  async findByExperienceId(experienceId: string): Promise<PhysicalSelectionRecord | null> {
    const selection = this.store.physicalSelections.get(experienceId);
    return selection ? structuredClone(selection) : null;
  }

  async confirmSizeAndAdvance(transition: SizeSelectionTransition): Promise<void> {
    const record = [...this.store.experiences.values()].find(
      (candidate) => candidate.id === transition.experienceId,
    );
    const selection = this.store.physicalSelections.get(transition.experienceId);
    if (!record || !selection) throw new Error('Physical selection not found');
    if (
      record.stage !== transition.expectedStage ||
      record.expiresAt <= transition.updatedAt ||
      selection.sizeCode
    ) {
      throw new Error('Physical selection stage conflict');
    }

    selection.sizeCode = transition.sizeCode;
    selection.updatedAt = transition.updatedAt;
    record.stage = transition.nextStage;
    record.updatedAt = transition.updatedAt;
  }

  async confirmBaseAndAdvance(transition: BaseSelectionTransition): Promise<void> {
    const record = [...this.store.experiences.values()].find(
      (candidate) => candidate.id === transition.experienceId,
    );
    const selection = this.store.physicalSelections.get(transition.experienceId);
    if (!record || !selection) throw new Error('Physical selection not found');
    if (
      record.stage !== transition.expectedStage ||
      record.expiresAt <= transition.updatedAt ||
      !selection.sizeCode ||
      selection.colorCode ||
      selection.variantId
    ) {
      throw new Error('Physical selection stage conflict');
    }

    selection.colorCode = transition.colorCode;
    selection.colorLabel = transition.colorLabel;
    selection.colorSwatch = transition.colorSwatch;
    selection.variantId = transition.variantId;
    selection.updatedAt = transition.updatedAt;
    record.stage = transition.nextStage;
    record.updatedAt = transition.updatedAt;
  }
}
