import { describe, expect, it } from 'vitest';
import {
  QUESTION_VAULT,
  REQUIRED_QUESTION_FAMILIES,
  type QuestionFamily,
  type VaultQuestionDefinition,
} from '@/domain/questions/QuestionVault';
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

function exclusionsFromFirstPromptPerFamily(): Record<QuestionFamily, string> {
  return Object.fromEntries(
    REQUIRED_QUESTION_FAMILIES.map((family) => [
      family,
      QUESTION_VAULT.find((question) => question.family === family)?.id,
    ]),
  ) as Record<QuestionFamily, string>;
}

describe('QuestionSelectionService repeat interviews', () => {
  it('excludes the immediately previous question in every family while preserving all seven families', async () => {
    const exclusions = exclusionsFromFirstPromptPerFamily();
    const service = new QuestionSelectionService(
      new MemoryQuestionSetRepository(),
      QUESTION_VAULT,
      () => 0,
    );

    const assigned = await service.assignExcluding('fresh-child', exclusions);

    expect(assigned).toHaveLength(7);
    expect(assigned.map((question) => question.family)).toEqual(REQUIRED_QUESTION_FAMILIES);
    for (const question of assigned) {
      expect(question.questionId).not.toBe(exclusions[question.family]);
    }
  });

  it('fails closed when a family has no active alternate after excluding the previous prompt', async () => {
    const exclusions = exclusionsFromFirstPromptPerFamily();
    const singleCulture = QUESTION_VAULT.find(
      (question) => question.family === 'culture' && question.id === exclusions.culture,
    );
    if (!singleCulture) throw new Error('test fixture culture question missing');

    const vault: VaultQuestionDefinition[] = [
      singleCulture,
      ...QUESTION_VAULT.filter((question) => question.family !== 'culture'),
    ];
    const service = new QuestionSelectionService(
      new MemoryQuestionSetRepository(),
      vault,
      () => 0,
    );

    await expect(service.assignExcluding('fresh-child', exclusions)).rejects.toThrow(
      'Question family has no active alternate prompts',
    );
  });
});
