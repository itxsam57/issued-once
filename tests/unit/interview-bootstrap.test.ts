import { hashSessionToken } from '@/server/http/sessionToken';
import { QUESTION_VAULT } from '@/domain/questions/QuestionVault';
import { InterviewBootstrapService } from '@/server/questions/InterviewBootstrapService';
import { QuestionSelectionService } from '@/server/questions/QuestionSelectionService';
import type { AssignedQuestionRecord, QuestionSetRepository } from '@/server/questions/QuestionSetRepository';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
} from '@/server/experience/ExperienceRepository';

class MemoryExperienceRepository implements ExperienceRepository {
  experiences = new Map<string, ExperienceRecord>();
  async create(record: ExperienceRecord) {
    this.experiences.set(record.publicSessionHash, structuredClone(record));
  }
  async findBySessionHash(hash: string) {
    return this.experiences.get(hash) ?? null;
  }
  async saveAnswerAndAdvance(_transition: AnswerTransition) {
    throw new Error('not used');
  }
}

class MemoryQuestionSetRepository implements QuestionSetRepository {
  assignments = new Map<string, readonly AssignedQuestionRecord[]>();
  async findByExperienceId(id: string) {
    return this.assignments.get(id) ?? null;
  }
  async createAssignment(input: {
    experienceId: string;
    questions: readonly AssignedQuestionRecord[];
    createdAt: Date;
  }) {
    if (this.assignments.has(input.experienceId)) return false;
    this.assignments.set(input.experienceId, input.questions);
    return true;
  }
}

test('bootstrap creates the session before Q1 is shown and resumes the same seven prompts', async () => {
  const experiences = new MemoryExperienceRepository();
  const selection = new QuestionSelectionService(
    new MemoryQuestionSetRepository(),
    QUESTION_VAULT,
    () => 0.42,
  );
  const service = new InterviewBootstrapService(experiences, selection);

  const first = await service.bootstrap();
  const resumed = await service.bootstrap(first.token);

  expect(first.questions).toHaveLength(7);
  expect(resumed.questions).toEqual(first.questions);
  expect(resumed.token).toBe(first.token);
  expect(experiences.experiences.has(hashSessionToken(first.token))).toBe(true);
});
