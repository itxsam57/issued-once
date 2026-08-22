import type { ExperienceStage, QuestionDefinition } from '@/domain/experience/types';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { ExperienceService } from '@/server/experience/ExperienceService';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { AssignedQuestionRecord } from './QuestionSetRepository';
import { toInterviewQuestions } from './QuestionSelectionService';

const POSITION_BY_STAGE: Partial<Record<ExperienceStage, number>> = {
  QUESTION_1: 1,
  QUESTION_2: 2,
  QUESTION_3: 3,
  QUESTION_4: 4,
  QUESTION_5: 5,
  QUESTION_6: 6,
  QUESTION_7: 7,
};

export type InterviewBootstrap = {
  token: string;
  stage: ExperienceStage;
  initialPosition: number;
  interviewComplete: boolean;
  questions: readonly QuestionDefinition[];
};

type QuestionAssigner = {
  assign(experienceId: string): Promise<readonly AssignedQuestionRecord[]>;
};

export class InterviewBootstrapService {
  constructor(
    private readonly experienceRepository: ExperienceRepository,
    private readonly questionSelection: QuestionAssigner,
  ) {}

  async bootstrap(existingToken?: string | null): Promise<InterviewBootstrap> {
    if (existingToken) {
      const existing = await this.experienceRepository.findBySessionHash(hashSessionToken(existingToken));
      if (existing) {
        const assignment = await this.questionSelection.assign(existing.id);
        return {
          token: existingToken,
          stage: existing.stage,
          initialPosition: POSITION_BY_STAGE[existing.stage] ?? 7,
          interviewComplete: !POSITION_BY_STAGE[existing.stage],
          questions: toInterviewQuestions(assignment),
        };
      }
    }

    const started = await new ExperienceService(this.experienceRepository).start({ hookId: 'public-entry' });
    const stored = await this.experienceRepository.findBySessionHash(hashSessionToken(started.token));
    if (!stored) throw new Error('Started experience could not be recovered');

    const assignment = await this.questionSelection.assign(stored.id);
    return {
      token: started.token,
      stage: started.stage,
      initialPosition: 1,
      interviewComplete: false,
      questions: toInterviewQuestions(assignment),
    };
  }
}
