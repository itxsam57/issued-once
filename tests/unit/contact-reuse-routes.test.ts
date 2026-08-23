import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock, createContactServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createContactServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/contact/runtimeContact', () => ({
  createContactService: createContactServiceMock,
  ContactRuntimeUnavailableError: class ContactRuntimeUnavailableError extends Error {},
}));

import { POST as checkEmail } from '@/app/api/contact/check-email/route';
import { POST as reuseVerified } from '@/app/api/contact/reuse-verified/route';

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function cookieHarness(input?: { session?: string; continuity?: string }) {
  const set = vi.fn();
  const get = vi.fn((name: string) => {
    if (name === '__Host-io_session' && input?.session) return { value: input.session };
    if (name === '__Host-io_contact_continuity' && input?.continuity) return { value: input.continuity };
    return undefined;
  });
  cookiesMock.mockResolvedValue({ get, set });
  return { get, set };
}

describe('repeat verified-email contact routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checks an entered email against server-side continuity proof without exposing the prior email', async () => {
    cookieHarness({ session: 'child-session', continuity: 'continuity-proof' });
    const checkContinuity = vi.fn().mockResolvedValue({ alreadyVerified: true });
    createContactServiceMock.mockReturnValue({ checkContinuity });

    const response = await checkEmail(request('/api/contact/check-email', { email: 'Sam@Example.com' }));

    expect(response.status).toBe(200);
    expect(checkContinuity).toHaveBeenCalledWith({
      experienceToken: 'child-session', email: 'Sam@Example.com', continuityToken: 'continuity-proof',
    });
    expect(await response.json()).toEqual({ alreadyVerified: true });
  });

  it('explicitly confirms reuse and clears the continuity cookie afterward', async () => {
    const { set } = cookieHarness({ session: 'child-session', continuity: 'continuity-proof' });
    const reuse = vi.fn().mockResolvedValue({ verified: true });
    createContactServiceMock.mockReturnValue({ reuseVerified: reuse });

    const response = await reuseVerified(request('/api/contact/reuse-verified', { email: 'sam@example.com' }));

    expect(response.status).toBe(200);
    expect(reuse).toHaveBeenCalledWith({
      experienceToken: 'child-session', email: 'sam@example.com', continuityToken: 'continuity-proof',
    });
    expect(set).toHaveBeenCalledWith('__Host-io_contact_continuity', '', expect.objectContaining({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
    }));
    expect(await response.json()).toEqual({ verified: true });
  });

  it('requires the current anonymous session and fails closed when explicit reuse is unavailable', async () => {
    cookieHarness({ continuity: 'continuity-proof' });
    expect((await checkEmail(request('/api/contact/check-email', { email: 'sam@example.com' }))).status).toBe(401);

    cookieHarness({ session: 'child-session' });
    createContactServiceMock.mockReturnValue({
      reuseVerified: vi.fn().mockRejectedValue(new Error('Verified email reuse is not available')),
    });
    const denied = await reuseVerified(request('/api/contact/reuse-verified', { email: 'sam@example.com' }));
    expect(denied.status).toBe(409);
    expect(await denied.json()).toEqual({ error: 'Verified email reuse is not available' });
  });
});
