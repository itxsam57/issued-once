import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
  StoredAnswer,
} from '@/server/experience/ExperienceRepository';

type PreviewStore = {
  experiences: Map<string, ExperienceRecord>;
  answers: Map<string, StoredAnswer>;
};

type PreviewGlobal = typeof globalThis & {
  __issuedOncePreviewExperienceStore?: PreviewStore;
};

function getStore(): PreviewStore {
  const runtime = globalThis as PreviewGlobal;
  runtime.__issuedOncePreviewExperienceStore ??= {
    experiences: new Map(),
    answers: new Map(),
  };
  return runtime.__issuedOncePreviewExperienceStore;
}

export class PreviewExperienceRepository implements ExperienceRepository {
  private readonly store = getStore();

  async create(record: ExperienceRecord): Promise<void> {
    this.store.experiences.set(record.publicSessionHash, structuredClone(record));
  }

  async findBySessionHash(publicSessionHash: string): Promise<ExperienceRecord | null> {
    const record = this.store.experiences.get(publicSessionHash);
    return record ? structuredClone(record) : null;
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
