import type { AssignedQuestionRecord, QuestionSetRepository } from '@/server/questions/QuestionSetRepository';
import { getPreviewStore } from './PreviewExperienceRepository';

export class PreviewQuestionSetRepository implements QuestionSetRepository {
  private readonly store = getPreviewStore();

  async findByExperienceId(experienceId: string): Promise<readonly AssignedQuestionRecord[] | null> {
    const assignment = this.store.questionAssignments.get(experienceId);
    return assignment ? structuredClone(assignment) : null;
  }

  async createAssignment(input: {
    experienceId: string;
    questions: readonly AssignedQuestionRecord[];
    createdAt: Date;
  }): Promise<boolean> {
    if (this.store.questionAssignments.has(input.experienceId)) return false;
    this.store.questionAssignments.set(input.experienceId, structuredClone(input.questions));
    return true;
  }
}
