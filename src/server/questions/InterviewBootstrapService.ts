import type { ExperienceStage, QuestionDefinition } from '@/domain/experience/types';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { ExperienceService } from '@/server/experience/ExperienceService';
import { createSessionToken, hashSessionToken } from '@/server/http/sessionToken';
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

const RETURN_CHOICE_STAGES = new Set<ExperienceStage>([
  'QUESTION_2',
  'QUESTION_3',
  'QUESTION_4',
  'QUESTION_5',
  'QUESTION_6',
  'QUESTION_7',
  'PROFILE_COMPLETE',
  'OBJECT_SELECTED',
  'SIZE_CONFIRMED',
  'COMMITMENT_READY',
]);

export type InterviewEntryMode = 'interview' | 'profile' | 'repeat-choice';

export type InterviewBootstrap = {
  token: string;
  stage: ExperienceStage;
  initialPosition: number;
  interviewComplete: boolean;
  entryMode: InterviewEntryMode;
  resumePrompt: boolean;
  questions: readonly QuestionDefinition[];
};

type QuestionAssigner = {
  assign(experienceId: string): Promise<readonly AssignedQuestionRecord[]>;
};

function entryModeFor(stage: ExperienceStage): InterviewEntryMode {
  if (stage === 'CHECKOUT_STARTED') return 'repeat-choice';
  if (POSITION_BY_STAGE[stage]) return 'interview';
  return 'profile';
}

function resumePromptFor(stage: ExperienceStage): boolean {
  return RETURN_CHOICE_STAGES.has(stage);
}

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
          entryMode: entryModeFor(existing.stage),
          resumePrompt: resumePromptFor(existing.stage),
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
      entryMode: 'interview',
      resumePrompt: false,
      questions: toInterviewQuestions(assignment),
    };
  }

  async restart(existingToken: string): Promise<InterviewBootstrap> {
    const expectedPublicSessionHash = hashSessionToken(existingToken);
    const existing = await this.experienceRepository.findBySessionHash(expectedPublicSessionHash);
    if (!existing) throw new Error('Experience restart session was not found');
    if (!resumePromptFor(existing.stage)) {
      throw new Error('Experience cannot be restarted from this stage');
    }

    const rotate = this.experienceRepository.rotateSessionHashIfCurrent;
    if (!rotate) throw new Error('Experience restart is unavailable');

    const retired = await rotate.call(this.experienceRepository, {
      experienceId: existing.id,
      expectedPublicSessionHash,
      publicSessionHash: hashSessionToken(createSessionToken()),
      updatedAt: new Date(),
    });
    if (!retired) throw new Error('Experience restart conflict');

    return this.bootstrap(null);
  }
}
