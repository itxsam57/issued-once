import { QUESTION_VAULT, REQUIRED_QUESTION_FAMILIES } from '@/domain/questions/QuestionVault';
import { QuestionSelectionService } from '@/server/questions/QuestionSelectionService';
import type {
  AssignedQuestionRecord,
  QuestionSetRepository,
} from '@/server/questions/QuestionSetRepository';

class MemoryQuestionSetRepository implements QuestionSetRepository {
  private readonly assignments = new Map<string, readonly AssignedQuestionRecord[]>();

  async findByExperienceId(experienceId: string) {
    return this.assignments.get(experienceId) ?? null;
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

test('assigns one question from every signal family and never reshuffles an experience', async () => {
  const repository = new MemoryQuestionSetRepository();
  const service = new QuestionSelectionService(repository, QUESTION_VAULT, () => 0.314159);

  const first = await service.assign('exp-1');
  const resumed = await service.assign('exp-1');

  expect(first).toHaveLength(7);
  expect(first.map((item) => item.slot)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
  expect(first.map((item) => item.family)).toEqual(REQUIRED_QUESTION_FAMILIES);
  expect(resumed).toEqual(first);
});

test('different random positions can produce different prompts without losing family coverage', async () => {
  const a = await new QuestionSelectionService(
    new MemoryQuestionSetRepository(),
    QUESTION_VAULT,
    () => 0.01,
  ).assign('exp-a');
  const b = await new QuestionSelectionService(
    new MemoryQuestionSetRepository(),
    QUESTION_VAULT,
    () => 0.91,
  ).assign('exp-b');

  expect(a.map((item) => item.family)).toEqual(REQUIRED_QUESTION_FAMILIES);
  expect(b.map((item) => item.family)).toEqual(REQUIRED_QUESTION_FAMILIES);
  expect(a.map((item) => item.questionId)).not.toEqual(b.map((item) => item.questionId));
});
