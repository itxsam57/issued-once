import type { CheckoutQuoteRecord } from '@/server/checkout/CheckoutService';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
  SessionHashRotation,
  StoredAnswer,
} from '@/server/experience/ExperienceRepository';
import type { ObjectType } from '@/server/physical/PhysicalSelectionRepository';
import type { AssignedQuestionRecord } from '@/server/questions/QuestionSetRepository';

export type PreviewPhysicalSelection = {
  experienceId: string;
  object: ObjectType;
  productSlug: string;
  sizeCode?: string;
  colorCode?: string;
  colorLabel?: string;
  colorSwatch?: string | null;
  variantId?: string;
  updatedAt: Date;
};

export type PreviewStore = {
  experiences: Map<string, ExperienceRecord>;
  answers: Map<string, StoredAnswer>;
  physicalSelections: Map<string, PreviewPhysicalSelection>;
  checkoutQuotes: Map<string, CheckoutQuoteRecord>;
  questionAssignments: Map<string, readonly AssignedQuestionRecord[]>;
};

type PreviewGlobal = typeof globalThis & {
  __issuedOncePreviewExperienceStore?: PreviewStore;
};

export function getPreviewStore(): PreviewStore {
  const runtime = globalThis as PreviewGlobal;
  runtime.__issuedOncePreviewExperienceStore ??= {
    experiences: new Map(),
    answers: new Map(),
    physicalSelections: new Map(),
    checkoutQuotes: new Map(),
    questionAssignments: new Map(),
  };
  return runtime.__issuedOncePreviewExperienceStore;
}

export class PreviewExperienceRepository implements ExperienceRepository {
  private readonly store = getPreviewStore();

  async create(record: ExperienceRecord): Promise<void> {
    this.store.experiences.set(record.publicSessionHash, structuredClone(record));
  }

  async findBySessionHash(publicSessionHash: string): Promise<ExperienceRecord | null> {
    const record = this.store.experiences.get(publicSessionHash);
    return record ? structuredClone(record) : null;
  }

  async rotateSessionHash(input: SessionHashRotation): Promise<boolean> {
    const entry = [...this.store.experiences.entries()].find(
      ([, candidate]) => candidate.id === input.experienceId,
    );
    if (!entry) return false;

    const [oldHash, record] = entry;
    this.store.experiences.delete(oldHash);
    this.store.experiences.set(input.publicSessionHash, {
      ...record,
      publicSessionHash: input.publicSessionHash,
      updatedAt: input.updatedAt,
    });
    return true;
  }

  async saveAnswerAndAdvance(transition: AnswerTransition): Promise<void> {
    const record = [...this.store.experiences.values()].find(
      (candidate) => candidate.id === transition.answer.experienceId,
    );

    if (!record) throw new Error('Experience not found');
    if (record.stage !== transition.expectedStage) throw new Error('Experience stage conflict');

    this.store.answers.set(
      `${transition.answer.experienceId}:${transition.answer.questionId}`,
      structuredClone(transition.answer),
    );
    record.stage = transition.nextStage;
    record.updatedAt = transition.updatedAt;
  }
}
