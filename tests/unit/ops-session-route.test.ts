import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieValue: null as string | null,
  setCookie: vi.fn(),
  record: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => mocks.cookieValue ? { value: mocks.cookieValue } : undefined,
    set: mocks.setCookie,
  }),
}));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsAuditService: () => ({ record: mocks.record }),
}));

import { createOpsSessionValue } from '@/server/ops/opsAuth';
import { DELETE, POST } from '@/app/api/ops/session/route';

const OWNER_TOKEN = 'owner-secret-token-that-is-long-enough';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookieValue = null;
  process.env.INTERNAL_OPERATIONS_TOKEN = OWNER_TOKEN;
  process.env.DATABASE_URL = 'postgres://configured-for-test';
  mocks.record.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.INTERNAL_OPERATIONS_TOKEN;
  delete process.env.DATABASE_URL;
});

test('successful owner login is audited before the private session cookie is issued', async () => {
  const response = await POST(new Request('https://issuedonce.shop/api/ops/session', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: OWNER_TOKEN }),
  }));

  expect(response.status).toBe(200);
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
    actor: 'OWNER', action: 'OPS_LOGIN', issueId: null, targetType: 'owner_session', targetId: 'OWNER',
  }));
  expect(JSON.stringify(mocks.record.mock.calls)).not.toContain(OWNER_TOKEN);
  expect(mocks.setCookie).toHaveBeenCalledWith('io_ops', expect.stringMatching(/^[a-f0-9]{64}$/), expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
});

test('production login fails closed when session auditing cannot be recorded', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
  mocks.record.mockRejectedValueOnce(new Error('database unavailable'));
  const response = await POST(new Request('https://issuedonce.shop/api/ops/session', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: OWNER_TOKEN }),
  }));
  expect(response.status).toBe(503);
  expect(mocks.setCookie).not.toHaveBeenCalled();
  Object.defineProperty(process.env, 'NODE_ENV', { value: previousNodeEnv, configurable: true });
});

test('logout clears the cookie even when audit recording fails and audits only a valid prior session', async () => {
  mocks.cookieValue = createOpsSessionValue();
  mocks.record.mockRejectedValueOnce(new Error('database unavailable'));
  const response = await DELETE();
  expect(response.status).toBe(200);
  expect(mocks.setCookie).toHaveBeenCalledWith('io_ops', '', expect.objectContaining({ maxAge: 0 }));
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'OPS_LOGOUT', targetType: 'owner_session', targetId: 'OWNER' }));
});
