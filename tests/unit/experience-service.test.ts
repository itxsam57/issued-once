import { beforeAll, describe, expect, test } from 'vitest';
import type { ExperienceStage, QuestionId } from '@/domain/experience/types';
import { decryptPrivatePayload } from '@/server/crypto/privatePayload';
import { hashSessionToken } from '@/server/http/sessionToken';
import { ExperienceService } from '@/server/experience/ExperienceService';
import type {
  ExperienceRecord,
  ExperienceRepository,
  StoredAnswer,
} from '@/server/experience/ExperienceRepository';

class MemoryExperienceRepository implements ExperienceRepository {
  experiences = new Map<string, ExperienceRecord>();
  answers = new Map<string, StoredAnswer>();

  async create(record: ExperienceRecord): Promise<void> {
    this.experiences.set(record.publicSessionHash, structuredClone(record));
  }

  async findBySessionHash(publicSessionHash: string): Promise<ExperienceRecord | null> {
    return this.experiences.get(publicSessionHash) ?? null;
  }

  async saveAnswer(answer: StoredAnswer): Promise<void> {
    this.answers.set(`${answer.experienceId}:${answer.questionId}`, structuredClone(answer));
  }

  async updateStage(experienceId: string, stage: ExperienceStage, updatedAt: Date): Promise<void> {
    const record = [...this.experiences.values()].find((item) => item.id === experienceId);
    if (!record) throw new Error('experience missing');
    record.stage = stage;
    record.updatedAt = updatedAt;
  }
}

beforeAll(() => {
  process.env.PRIVATE_PAYLOAD_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
});

describe('ExperienceService', () => {
  test('starts anonymously, stores only the session hash, encrypts Q1, and advances to Q2', async () => {
    const repository = new MemoryExperienceRepository();
    const service = new ExperienceService(repository);

    const started = await service.start({ hookId: 'story-ai-shop' });
    const stored = repository.experiences.get(hashSessionToken(started.token));

    expect(stored).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain(started.token);
    expect(stored?.stage).toBe('QUESTION_1');

    const result = await service.answer({
      token: started.token,
      questionId: 'q1' as QuestionId,
      answer: 'maps, moths, and late-night radio',
    });

    expect(result.stage).toBe('QUESTION_2');
    const savedAnswer = repository.answers.get(`${stored?.id}:q1`);
    expect(savedAnswer).toBeDefined();
    expect(JSON.stringify(savedAnswer)).not.toContain('maps, moths, and late-night radio');
    expect(decryptPrivatePayload(savedAnswer!.encryptedPayload)).toEqual({
      answer: 'maps, moths, and late-night radio',
    });
  });
});
