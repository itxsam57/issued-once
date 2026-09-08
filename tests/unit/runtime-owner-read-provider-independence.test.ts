import { afterEach, expect, test, vi } from 'vitest';

const { createManufacturingServiceMock, queryMock } = vi.hoisted(() => ({
  createManufacturingServiceMock: vi.fn(() => { throw new Error('PRINTFUL_API_TOKEN is required'); }),
  queryMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/server/experience/NeonSqlExecutor', () => ({
  createNeonSqlExecutor: () => ({ query: queryMock }),
}));
vi.mock('@/server/manufacturing/runtimeManufacturing', () => ({
  createManufacturingService: createManufacturingServiceMock,
}));

import { createOpsManufacturingService } from '@/server/ops/runtimeOwnerOs';

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.clearAllMocks();
});

test('read-only Owner manufacturing queue does not require Printful mutation runtime', async () => {
  process.env.DATABASE_URL = 'postgresql://example.invalid/test';

  const service = createOpsManufacturingService();
  const queue = await service.listQueue(2);

  expect(queue).toEqual([]);
  expect(queryMock).toHaveBeenCalledTimes(1);
  expect(createManufacturingServiceMock).not.toHaveBeenCalled();
});

test('read-only Owner support queue does not require Resend reply runtime', async () => {
  process.env.DATABASE_URL = 'postgresql://example.invalid/test';
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;

  const { createOpsSupportService } = await import('@/server/ops/runtimeOwnerOs');
  const service = createOpsSupportService();
  const queue = await service.list(null, 2);

  expect(queue).toEqual([]);
  expect(queryMock).toHaveBeenCalledTimes(1);
});
