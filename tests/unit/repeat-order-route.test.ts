import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';

const { cookiesMock, createRepeatOrderServiceMock, createContactContinuityTokenMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createRepeatOrderServiceMock: vi.fn(),
  createContactContinuityTokenMock: vi.fn().mockReturnValue('signed-continuity-token'),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/experience/runtimeRepeatOrders', () => ({
  createRepeatOrderService: createRepeatOrderServiceMock,
  RepeatOrderRuntimeUnavailableError: class RepeatOrderRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/contact/contactContinuity', () => ({
  createContactContinuityToken: createContactContinuityTokenMock,
}));

import { POST } from '@/app/api/experience/repeat/route';

const safeQuestions = [
  ['q1', 'culture'], ['q2', 'place'], ['q3', 'rhythm'], ['q4', 'identity'],
  ['q5', 'music'], ['q6', 'boundary'], ['q7', 'wildcard'],
].map(([slot, family], index) => ({
  slot,
  ordinal: index + 1,
  questionId: `new-${family}`,
  questionVersion: 1,
  family,
  prompt: `Fresh ${family} prompt`,
  kind: 'text' as const,
  optional: slot === 'q7',
}));

function cookieHarness(token?: string) {
  const set = vi.fn();
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue(token ? { value: token } : undefined),
    set,
  });
  return { set };
}

function request(body: unknown) {
  return new Request('http://localhost/api/experience/repeat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/experience/repeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createContactContinuityTokenMock.mockReturnValue('signed-continuity-token');
  });

  it('rejects invalid and extra fields', async () => {
    cookieHarness('source-token');
    expect((await POST(request({ choice: 'other' }))).status).toBe(400);
    expect((await POST(request({ choice: 'reuse', extra: true }))).status).toBe(400);
    expect(createRepeatOrderServiceMock).not.toHaveBeenCalled();
  });

  it('requires an existing customer session', async () => {
    cookieHarness();
    const response = await POST(request({ choice: 'reuse' }));
    expect(response.status).toBe(401);
  });

  it('rotates session and issues signed continuity only when the source has verified contact', async () => {
    const { set } = cookieHarness('source-token');
    createRepeatOrderServiceMock.mockReturnValue({
      choose: vi.fn().mockResolvedValue({
        token: 'child-token',
        mode: 'reuse',
        stage: 'PROFILE_COMPLETE',
        experienceId: 'child-exp',
        questions: safeQuestions,
        contactContinuity: { sourceContactId: 'source-contact', emailHash: 'a'.repeat(64) },
      }),
    });

    const response = await POST(request({ choice: 'reuse' }));

    expect(response.status).toBe(200);
    expect(createContactContinuityTokenMock).toHaveBeenCalledWith({
      sourceContactId: 'source-contact',
      emailHash: 'a'.repeat(64),
      childSessionHash: hashSessionToken('child-token'),
      issuedAt: expect.any(Date),
    });
    expect(set).toHaveBeenCalledWith('__Host-io_session', 'child-token', expect.objectContaining({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/',
    }));
    expect(set).toHaveBeenCalledWith('__Host-io_contact_continuity', 'signed-continuity-token', expect.objectContaining({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/',
    }));
    expect(await response.json()).toEqual({
      entryMode: 'form', stage: 'PROFILE_COMPLETE', initialPosition: 7, interviewComplete: true, questions: [],
    });
  });

  it('does not issue continuity proof when the source has no verified contact', async () => {
    const { set } = cookieHarness('source-token');
    createRepeatOrderServiceMock.mockReturnValue({
      choose: vi.fn().mockResolvedValue({
        token: 'child-token', mode: 'reuse', stage: 'PROFILE_COMPLETE', experienceId: 'child-exp', questions: safeQuestions,
      }),
    });

    const response = await POST(request({ choice: 'reuse' }));
    expect(response.status).toBe(200);
    expect(createContactContinuityTokenMock).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalledWith('__Host-io_contact_continuity', expect.anything(), expect.anything());
  });

  it('returns seven safe fresh questions and starts at the resolved stage', async () => {
    const { set } = cookieHarness('source-token');
    createRepeatOrderServiceMock.mockReturnValue({
      choose: vi.fn().mockResolvedValue({
        token: 'fresh-child-token', mode: 'fresh', stage: 'QUESTION_1', experienceId: 'fresh-exp', questions: safeQuestions,
      }),
    });

    const response = await POST(request({ choice: 'fresh' }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.entryMode).toBe('interview');
    expect(payload.stage).toBe('QUESTION_1');
    expect(payload.initialPosition).toBe(1);
    expect(payload.interviewComplete).toBe(false);
    expect(payload.questions).toHaveLength(7);
    expect(payload.questions[0]).toEqual({ id: 'q1', prompt: 'Fresh culture prompt', kind: 'text', optional: false });
    expect(payload.questions[0]).not.toHaveProperty('questionId');
    expect(payload.questions[0]).not.toHaveProperty('experienceId');
    expect(set).toHaveBeenCalled();
  });

  it('reports the actual winning mode instead of the requested opposite choice', async () => {
    cookieHarness('source-token');
    createRepeatOrderServiceMock.mockReturnValue({
      choose: vi.fn().mockResolvedValue({
        token: 'winner-token', mode: 'reuse', stage: 'PROFILE_COMPLETE', experienceId: 'winner-exp', questions: safeQuestions,
      }),
    });
    const response = await POST(request({ choice: 'fresh' }));
    expect((await response.json()).entryMode).toBe('form');
  });

  it('maps runtime configuration and lifecycle failures without exposing internals', async () => {
    cookieHarness('source-token');
    const runtimeErrorClass = (await import('@/server/experience/runtimeRepeatOrders')).RepeatOrderRuntimeUnavailableError;
    createRepeatOrderServiceMock.mockImplementationOnce(() => { throw new runtimeErrorClass(); });
    expect((await POST(request({ choice: 'reuse' }))).status).toBe(503);

    createRepeatOrderServiceMock.mockReturnValueOnce({ choose: vi.fn().mockRejectedValue(new Error('Repeat order is not unlocked')) });
    expect((await POST(request({ choice: 'reuse' }))).status).toBe(409);
  });
});
