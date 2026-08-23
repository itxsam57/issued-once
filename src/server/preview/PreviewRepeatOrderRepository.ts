import type { RepeatOrderChild, RepeatOrderMode, RepeatOrderRepository } from '@/server/experience/RepeatOrderRepository';
import { getPreviewStore } from './PreviewExperienceRepository';

function modeFromHook(hookId: string | null): RepeatOrderMode {
  if (hookId === 'repeat:reuse') return 'reuse';
  if (hookId === 'repeat:fresh') return 'fresh';
  throw new Error('Repeat order has an unexpected persisted mode');
}

export class PreviewRepeatOrderRepository implements RepeatOrderRepository {
  async resolve(input: {
    sourceExperienceId: string;
    childExperienceId: string;
    childSessionHash: string;
    requestedMode: RepeatOrderMode;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<RepeatOrderChild> {
    const store = getPreviewStore();
    const existing = store.experiences.get(input.childSessionHash);
    if (existing) {
      return {
        experienceId: existing.id,
        mode: modeFromHook(existing.hookId),
        stage: existing.stage,
        created: false,
      };
    }

    if (input.requestedMode === 'reuse') {
      const sourceQuestions = store.questionAssignments.get(input.sourceExperienceId);
      const sourceAnswers = [...store.answers.values()].filter(
        (answer) => answer.experienceId === input.sourceExperienceId,
      );
      if (!sourceQuestions || sourceQuestions.length !== 7 || sourceAnswers.length !== 7) {
        throw new Error('Repeat profile copy is incomplete');
      }

      store.experiences.set(input.childSessionHash, {
        id: input.childExperienceId,
        publicSessionHash: input.childSessionHash,
        stage: 'PROFILE_COMPLETE',
        hookId: 'repeat:reuse',
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        expiresAt: input.expiresAt,
      });
      store.questionAssignments.set(
        input.childExperienceId,
        structuredClone(sourceQuestions),
      );
      for (const answer of sourceAnswers) {
        const copied = structuredClone(answer);
        copied.experienceId = input.childExperienceId;
        store.answers.set(
          `${input.childExperienceId}:${copied.questionId}`,
          copied,
        );
      }

      return {
        experienceId: input.childExperienceId,
        mode: 'reuse',
        stage: 'PROFILE_COMPLETE',
        created: true,
      };
    }

    store.experiences.set(input.childSessionHash, {
      id: input.childExperienceId,
      publicSessionHash: input.childSessionHash,
      stage: 'QUESTION_1',
      hookId: 'repeat:fresh',
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      expiresAt: input.expiresAt,
    });
    return {
      experienceId: input.childExperienceId,
      mode: 'fresh',
      stage: 'QUESTION_1',
      created: true,
    };
  }
}
