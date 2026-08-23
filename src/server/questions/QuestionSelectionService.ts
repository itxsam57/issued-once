import type { QuestionDefinition, QuestionId } from '@/domain/experience/types';
import {
  REQUIRED_QUESTION_FAMILIES,
  type QuestionFamily,
  type VaultQuestionDefinition,
} from '@/domain/questions/QuestionVault';
import type { AssignedQuestionRecord, QuestionSetRepository } from './QuestionSetRepository';

const SLOTS: readonly QuestionId[] = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];

type ExcludedByFamily = Readonly<Partial<Record<QuestionFamily, string>>>;

function selectWeighted(
  candidates: readonly VaultQuestionDefinition[],
  random: () => number,
): VaultQuestionDefinition {
  const usable = candidates.filter((question) => question.active && question.weight > 0);
  if (!usable.length) throw new Error('Question family has no active prompts');

  const total = usable.reduce((sum, question) => sum + question.weight, 0);
  const sample = Math.min(Math.max(random(), 0), 0.999999999999) * total;
  let cursor = 0;

  for (const question of usable) {
    cursor += question.weight;
    if (sample < cursor) return question;
  }

  return usable[usable.length - 1];
}

function candidatesFor(
  vault: readonly VaultQuestionDefinition[],
  family: QuestionFamily,
): readonly VaultQuestionDefinition[] {
  return vault.filter((question) => question.family === family);
}

export class QuestionSelectionService {
  constructor(
    private readonly repository: QuestionSetRepository,
    private readonly vault: readonly VaultQuestionDefinition[],
    private readonly random: () => number = Math.random,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async assign(experienceId: string): Promise<readonly AssignedQuestionRecord[]> {
    return this.assignWithExclusions(experienceId, {});
  }

  async assignExcluding(
    experienceId: string,
    excludedByFamily: ExcludedByFamily,
  ): Promise<readonly AssignedQuestionRecord[]> {
    return this.assignWithExclusions(experienceId, excludedByFamily);
  }

  private async assignWithExclusions(
    experienceId: string,
    excludedByFamily: ExcludedByFamily,
  ): Promise<readonly AssignedQuestionRecord[]> {
    const existing = await this.repository.findByExperienceId(experienceId);
    if (existing) return existing;

    const questions = REQUIRED_QUESTION_FAMILIES.map((family, index) => {
      const excludedId = excludedByFamily[family];
      const familyCandidates = candidatesFor(this.vault, family);
      const candidates = excludedId
        ? familyCandidates.filter((question) => question.id !== excludedId)
        : familyCandidates;

      if (
        excludedId &&
        !candidates.some((question) => question.active && question.weight > 0)
      ) {
        throw new Error('Question family has no active alternate prompts');
      }

      const selected = selectWeighted(candidates, this.random);
      return {
        slot: SLOTS[index],
        ordinal: index + 1,
        questionId: selected.id,
        questionVersion: selected.version,
        family,
        prompt: selected.prompt,
        kind: selected.kind,
        optional: selected.optional,
        choices: selected.choices,
      } satisfies AssignedQuestionRecord;
    });

    const created = await this.repository.createAssignment({
      experienceId,
      questions,
      createdAt: this.now(),
    });
    if (created) return questions;

    const raced = await this.repository.findByExperienceId(experienceId);
    if (!raced) throw new Error('Question assignment could not be persisted');
    return raced;
  }
}

export function toInterviewQuestions(
  assignment: readonly AssignedQuestionRecord[],
): readonly QuestionDefinition[] {
  return assignment.map((item) => ({
    id: item.slot,
    prompt: item.prompt,
    kind: item.kind,
    optional: item.optional,
    choices: item.choices,
  }));
}
