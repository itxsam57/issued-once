import { describe, expect, it } from 'vitest';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
} from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import { InterviewBootstrapService } from '@/server/questions/InterviewBootstrapService';
import type { AssignedQuestionRecord } from '@/server/questions/QuestionSetRepository';

class MemoryExperiences implements ExperienceRepository {
  constructor(private readonly record: ExperienceRecord) {}
  async create(_record: ExperienceRecord) {}
  async findBySessionHash(hash: string) {
    return hash === this.record.publicSessionHash ? structuredClone(this.record) : null;
  }
  async saveAnswerAndAdvance(_transition: AnswerTransition) {
    throw new Error('not used');
  }
}

const questions: AssignedQuestionRecord[] = [
  ['q1', 'culture'], ['q2', 'place'], ['q3', 'rhythm'], ['q4', 'identity'],
  ['q5', 'music'], ['q6', 'boundary'], ['q7', 'wildcard'],
].map(([slot, family], index) => ({
  slot: slot as AssignedQuestionRecord['slot'],
  ordinal: index + 1,
  questionId: `question-${slot}`,
  questionVersion: 1,
  family: family as AssignedQuestionRecord['family'],
  prompt: `Prompt ${slot}`,
  kind: 'text' as const,
  optional: slot === 'q7',
}));

const questionAssigner = { assign: async () => questions };

function experience(stage: ExperienceRecord['stage'], token = `token-${stage}`): ExperienceRecord {
  return {
    id: `experience-${stage}`,
    publicSessionHash: hashSessionToken(token),
    stage,
    hookId: 'public-entry',
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
    updatedAt: new Date('2026-08-23T00:10:00.000Z'),
    expiresAt: new Date('2026-09-22T00:00:00.000Z'),
  };
}

describe('InterviewBootstrapService repeat-order entry', () => {
  it('returns repeat-choice for terminal checkout without creating or rotating the session', async () => {
    const token = 'terminal-token';
    const service = new InterviewBootstrapService(
      new MemoryExperiences(experience('CHECKOUT_STARTED', token)),
      questionAssigner,
    );

    const result = await service.bootstrap(token);

    expect(result).toMatchObject({
      token,
      stage: 'CHECKOUT_STARTED',
      initialPosition: 7,
      interviewComplete: true,
      entryMode: 'repeat-choice',
    });
    expect(result.questions).toHaveLength(7);
  });

  it.each([
    'QUESTION_1', 'QUESTION_2', 'QUESTION_3', 'QUESTION_4',
    'QUESTION_5', 'QUESTION_6', 'QUESTION_7',
  ] as const)('marks %s as interview entry', async (stage) => {
    const token = `token-${stage}`;
    const service = new InterviewBootstrapService(
      new MemoryExperiences(experience(stage, token)),
      questionAssigner,
    );
    expect((await service.bootstrap(token)).entryMode).toBe('interview');
  });

  it('marks PROFILE_COMPLETE as profile entry', async () => {
    const token = 'profile-token';
    const service = new InterviewBootstrapService(
      new MemoryExperiences(experience('PROFILE_COMPLETE', token)),
      questionAssigner,
    );
    expect((await service.bootstrap(token)).entryMode).toBe('profile');
  });
});
