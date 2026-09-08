import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
  hasOpsSessionMock,
  createOpsDashboardRepositoryMock,
  createOpsAttentionRepositoryMock,
  createOpsCustomerRepositoryMock,
  emailLookupHashMock,
} = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createOpsDashboardRepositoryMock: vi.fn(),
  createOpsAttentionRepositoryMock: vi.fn(),
  createOpsCustomerRepositoryMock: vi.fn(),
  emailLookupHashMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({
  hasOpsSession: hasOpsSessionMock,
}));

vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsDashboardRepository: createOpsDashboardRepositoryMock,
  createOpsAttentionRepository: createOpsAttentionRepositoryMock,
  createOpsCustomerRepository: createOpsCustomerRepositoryMock,
}));

vi.mock('@/server/ops/runtimeOps', () => ({
  OpsRuntimeUnavailableError: class OpsRuntimeUnavailableError extends Error {},
}));

vi.mock('@/server/contact/ContactService', () => ({
  emailLookupHash: emailLookupHashMock,
}));

import { GET as getDashboard } from '@/app/ops/api/dashboard/route';
import { GET as getAttention } from '@/app/ops/api/attention/route';
import { GET as getCustomers } from '@/app/ops/api/customers/route';

function renderedConsoleCalls(calls: unknown[][]): string {
  return calls.flat().map((value) => String(value)).join('\n');
}

describe('owner API route log privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasOpsSessionMock.mockResolvedValue(true);
    emailLookupHashMock.mockReturnValue('lookup-hash');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('dashboard keeps unknown repository details out of logs while preserving its 500 contract', async () => {
    const sentinel = 'owner-dashboard-sensitive-error-sentinel';
    createOpsDashboardRepositoryMock.mockReturnValue({
      getDashboard: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getDashboard();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Owner dashboard failed' });
    expect(renderedConsoleCalls(consoleError.mock.calls)).toContain('owner dashboard failed');
    expect(renderedConsoleCalls(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('attention queue keeps unknown repository details out of logs while preserving its 503 contract', async () => {
    const sentinel = 'owner-attention-sensitive-error-sentinel';
    createOpsAttentionRepositoryMock.mockReturnValue({
      list: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getAttention();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Attention queue unavailable' });
    expect(renderedConsoleCalls(consoleError.mock.calls)).toContain('Owner attention queue failed');
    expect(renderedConsoleCalls(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('customer lookup keeps unknown repository details and lookup input out of logs while preserving its 503 contract', async () => {
    const sentinel = 'owner-customer-sensitive-error-sentinel';
    const lookupEmail = 'sensitive-customer@example.test';
    createOpsCustomerRepositoryMock.mockReturnValue({
      listCustomers: vi.fn().mockRejectedValue(new Error(`${sentinel}:${lookupEmail}`)),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getCustomers(new Request(`https://issuedonce.shop/ops/api/customers?email=${encodeURIComponent(lookupEmail)}`));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Customers unavailable' });
    const renderedLogs = renderedConsoleCalls(consoleError.mock.calls);
    expect(renderedLogs).toContain('Owner customer list failed');
    expect(renderedLogs).not.toContain(sentinel);
    expect(renderedLogs).not.toContain(lookupEmail);
  });
});
