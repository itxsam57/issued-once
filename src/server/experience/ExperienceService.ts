import { randomUUID } from 'node:crypto';
import { nextStage } from '@/domain/experience/progress';
import type { ExperienceStage, QuestionId } from '@/domain/experience/types';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { createSessionToken, hashSessionToken } from '@/server/http/sessionToken';
import type { ExperienceRepository } from './ExperienceRepository';

const QUESTION_STAGE: Record<QuestionId, ExperienceStage> = {
  q1: 'QUESTION_1',
  q2: 'QUESTION_2',
  q3: 'QUESTION_3',
  q4: 'QUESTION_4',
  q5: 'QUESTION_5',
  q6: 'QUESTION_6',
  q7: 'QUESTION_7',
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class ExperienceService {
  constructor(
    private readonly repository: ExperienceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start(input: { hookId?: string | null } = {}): Promise<{ token: string; stage: ExperienceStage }> {
    const token = createSessionToken();
    const createdAt = this.now();

    await this.repository.create({
      id: randomUUID(),
      publicSessionHash: hashSessionToken(token),
      stage: 'QUESTION_1',
      hookId: input.hookId ?? null,
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + SESSION_TTL_MS),
    });

    return { token, stage: 'QUESTION_1' };
  }

  async answer(input: {
    token: string;
    questionId: QuestionId;
    answer: string;
  }): Promise<{ stage: ExperienceStage }> {
    const publicSessionHash = hashSessionToken(input.token);
    const experience = await this.repository.findBySessionHash(publicSessionHash);
    if (!experience) throw new Error('Experience not found');

    const expectedStage = QUESTION_STAGE[input.questionId];
    if (experience.stage !== expectedStage) {
      throw new Error('Question does not match the current experience stage');
    }

    const answer = input.answer.trim();
    if (!answer && input.questionId !== 'q7') {
      throw new Error('Answer is required');
    }

    const updatedAt = this.now();
    const followingStage = nextStage(experience.stage);

    await this.repository.saveAnswerAndAdvance({
      answer: {
        experienceId: experience.id,
        questionId: input.questionId,
        encryptedPayload: await encryptPrivatePayload({ answer }),
        answeredAt: updatedAt,
      },
      expectedStage,
      nextStage: followingStage,
      updatedAt,
    });

    return { stage: followingStage };
  }
}
