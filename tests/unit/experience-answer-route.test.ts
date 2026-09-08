import { beforeEach, describe, expect, test, vi } from 'vitest';

const { cookiesMock, getExperienceRepositoryMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  getExperienceRepositoryMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/experience/runtimeRepository', () => ({
  getExperienceRepository: getExperienceRepositoryMock,
  PersistentExperienceRepositoryUnavailableError: class PersistentExperienceRepositoryUnavailableError extends Error {},
}));

import { POST } from '@/app/api/experience/answer/route';

describe('POST /api/experience/answer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QUIZ_ENCRYPTION_KEY_V1;
    delete process.env.QUIZ_ENCRYPTION_KEY_V2;
  });

  test('reports missing active answer encryption configuration as service unavailable instead of a state conflict', async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'live-session-token' }),
    });
    getExperienceRepositoryMock.mockReturnValue({
      findBySessionHash: vi.fn().mockResolvedValue({
        id: 'experience-live',
        publicSessionHash: 'opaque',
        stage: 'QUESTION_1',
        hookId: null,
        createdAt: new Date('2026-08-20T14:00:00.000Z'),
        updatedAt: new Date('2026-08-20T14:00:00.000Z'),
        expiresAt: new Date('2026-09-20T14:00:00.000Z'),
      }),
      saveAnswerAndAdvance: vi.fn(),
    });

    const response = await POST(new Request('http://localhost/api/experience/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'q1', answer: 'The Master and Margarita' }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Answer persistence is unavailable' });
  });
});
