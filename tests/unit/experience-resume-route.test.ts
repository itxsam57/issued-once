import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock, createExperienceResumeServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createExperienceResumeServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/experience/runtimeResume', () => ({
  createExperienceResumeService: createExperienceResumeServiceMock,
  ExperienceResumeRuntimeUnavailableError: class ExperienceResumeRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/api/experience/resume/route';
import { ExperienceResumeRuntimeUnavailableError } from '@/server/experience/runtimeResume';

function withSession(value?: string) {
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue(value ? { value } : undefined),
  });
}

describe('POST /api/experience/resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSession('returning-token');
  });

  it('requires an existing customer session', async () => {
    withSession();
    expect((await POST()).status).toBe(401);
    expect(createExperienceResumeServiceMock).not.toHaveBeenCalled();
  });

  it('returns only safe physical workflow state needed to reconstruct the saved step', async () => {
    const read = vi.fn().mockResolvedValue({
      phase: 'commitment',
      object: 'tee',
      sizeCode: 'M',
      color: { code: 'Black', label: 'Black' },
      quote: {
        quoteId: 'quote-1', amountMinor: 5600, currency: 'USD',
        expiresAt: '2026-09-10T02:00:00.000Z',
      },
    });
    createExperienceResumeServiceMock.mockReturnValue({ read });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(read).toHaveBeenCalledWith('returning-token');
    expect(payload).toEqual({
      phase: 'commitment',
      object: 'tee',
      sizeCode: 'M',
      color: { code: 'Black', label: 'Black' },
      quote: {
        quoteId: 'quote-1', amountMinor: 5600, currency: 'USD',
        expiresAt: '2026-09-10T02:00:00.000Z',
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(/email|address|phone|recipient|cipher|contactId/i);
  });

  it('maps unavailable and stale saved state without exposing internals', async () => {
    createExperienceResumeServiceMock.mockImplementationOnce(() => {
      throw new ExperienceResumeRuntimeUnavailableError('DATABASE_URL is missing');
    });
    const unavailable = await POST();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: 'Saved Issue continuation is unavailable' });

    createExperienceResumeServiceMock.mockReturnValueOnce({
      read: vi.fn().mockRejectedValue(new Error('Saved base selection is no longer available: provider-secret')),
    });
    const conflict = await POST();
    const conflictPayload = await conflict.json();
    expect(conflict.status).toBe(409);
    expect(conflictPayload).toEqual({ error: 'This unfinished Issue can no longer be continued' });
    expect(JSON.stringify(conflictPayload)).not.toContain('provider-secret');
  });
});
