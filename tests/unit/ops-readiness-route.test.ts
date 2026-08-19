import { beforeEach, expect, test, vi } from 'vitest';

const { hasOpsSessionMock, createReadinessServiceMock } = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createReadinessServiceMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeReadiness', () => ({ createReadinessService: createReadinessServiceMock }));

import { GET } from '@/app/ops/api/readiness/route';

beforeEach(() => {
  vi.clearAllMocks();
  hasOpsSessionMock.mockResolvedValue(true);
  createReadinessServiceMock.mockReturnValue({
    check: vi.fn(async () => ({
      checkedAt: '2026-08-19T00:00:00.000Z',
      readyForSandbox: false,
      readyForProduction: false,
      checks: [{ key: 'database', label: 'Neon database', state: 'ready', detail: 'Read-only database ping succeeded.' }],
    })),
  });
});

test('returns safe readiness only to an authenticated ops session', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.checks[0]).toMatchObject({ key: 'database', state: 'ready' });
  expect(JSON.stringify(body)).not.toMatch(/postgresql:\/\/|Bearer |sk-|re_/i);
});

test('unauthenticated readiness request is rejected before external probes run', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  const response = await GET();
  expect(response.status).toBe(401);
  expect(createReadinessServiceMock).not.toHaveBeenCalled();
});
