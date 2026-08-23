import { randomUUID } from 'node:crypto';
import type { ExperienceRepository } from './ExperienceRepository';
import type { RepeatOrderMode, RepeatOrderRepository } from './RepeatOrderRepository';
import {
  REQUIRED_QUESTION_FAMILIES,
  type QuestionFamily,
} from '@/domain/questions/QuestionVault';
import {
  deriveNextOrderSessionToken,
  hashSessionToken,
} from '@/server/http/sessionToken';
import type { AssignedQuestionRecord } from '@/server/questions/QuestionSetRepository';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type QuestionProfileGateway = {
  findByExperienceId(
    experienceId: string,
  ): Promise<readonly AssignedQuestionRecord[] | null>;
  assignExcluding(
    experienceId: string,
    excludedByFamily: Readonly<Partial<Record<QuestionFamily, string>>>,
  ): Promise<readonly AssignedQuestionRecord[]>;
};

type Dependencies = {
  experiences: Pick<ExperienceRepository, 'findBySessionHash'>;
  repeats: RepeatOrderRepository;
  questions: QuestionProfileGateway;
  now?: () => Date;
  createId?: () => string;
};

function requireCompleteAssignment(
  assignment: readonly AssignedQuestionRecord[] | null,
  message: string,
): readonly AssignedQuestionRecord[] {
  if (!assignment || assignment.length !== REQUIRED_QUESTION_FAMILIES.length) {
    throw new Error(message);
  }

  for (const family of REQUIRED_QUESTION_FAMILIES) {
    if (!assignment.some((question) => question.family === family)) {
      throw new Error(message);
    }
  }
  return assignment;
}

export class RepeatOrderService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
  }

  async choose(input: {
    sessionToken: string;
    mode: RepeatOrderMode;
  }): Promise<{
    token: string;
    mode: RepeatOrderMode;
    stage: Awaited<ReturnType<RepeatOrderRepository['resolve']>>['stage'];
    experienceId: string;
    questions: readonly AssignedQuestionRecord[];
  }> {
    const source = await this.dependencies.experiences.findBySessionHash(
      hashSessionToken(input.sessionToken),
    );
    if (!source) throw new Error('Experience not found');
    if (source.stage !== 'CHECKOUT_STARTED') {
      throw new Error('Repeat order is not unlocked');
    }

    const sourceQuestions = requireCompleteAssignment(
      await this.dependencies.questions.findByExperienceId(source.id),
      'Source profile assignment is incomplete',
    );

    const token = deriveNextOrderSessionToken(input.sessionToken);
    const createdAt = this.now();
    const child = await this.dependencies.repeats.resolve({
      sourceExperienceId: source.id,
      childExperienceId: this.createId(),
      childSessionHash: hashSessionToken(token),
      requestedMode: input.mode,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + SESSION_TTL_MS),
    });

    if (child.mode === 'reuse') {
      const questions = requireCompleteAssignment(
        await this.dependencies.questions.findByExperienceId(child.experienceId),
        'Repeat profile assignment is incomplete',
      );
      return {
        token,
        mode: child.mode,
        stage: child.stage,
        experienceId: child.experienceId,
        questions,
      };
    }

    const excludedByFamily = Object.fromEntries(
      sourceQuestions.map((question) => [question.family, question.questionId]),
    ) as Record<QuestionFamily, string>;
    const questions = requireCompleteAssignment(
      await this.dependencies.questions.assignExcluding(
        child.experienceId,
        excludedByFamily,
      ),
      'Fresh profile assignment is incomplete',
    );

    for (const family of REQUIRED_QUESTION_FAMILIES) {
      const selected = questions.find((question) => question.family === family);
      if (!selected || selected.questionId === excludedByFamily[family]) {
        throw new Error('Fresh profile assignment reused a previous prompt');
      }
    }

    return {
      token,
      mode: child.mode,
      stage: child.stage,
      experienceId: child.experienceId,
      questions,
    };
  }
}
