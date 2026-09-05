import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
  cookiesMock,
  createSupportServiceMock,
  createIssueStatusServiceMock,
  createPaymentServiceMock,
  createManufacturingEventServiceMock,
  referralsAreEnabledMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createSupportServiceMock: vi.fn(),
  createIssueStatusServiceMock: vi.fn(),
  createPaymentServiceMock: vi.fn(),
  createManufacturingEventServiceMock: vi.fn(),
  referralsAreEnabledMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));

vi.mock('@/server/support/runtimeSupport', () => ({
  SupportRuntimeUnavailableError: class SupportRuntimeUnavailableError extends Error {},
  createSupportService: createSupportServiceMock,
}));

vi.mock('@/server/issues/runtimeIssueStatus', () => ({
  IssueStatusRuntimeUnavailableError: class IssueStatusRuntimeUnavailableError extends Error {},
  createIssueStatusService: createIssueStatusServiceMock,
}));

vi.mock('@/server/payments/runtimePayments', () => ({
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
  createPaymentService: createPaymentServiceMock,
}));

vi.mock('@/server/issues/runtimeIssues', () => ({
  IssueRuntimeUnavailableError: class IssueRuntimeUnavailableError extends Error {},
  createIssueService: vi.fn(),
}));

vi.mock('@/server/payments/finalizePaidAttempt', () => ({ finalizePaidAttempt: vi.fn() }));
vi.mock('@/server/referrals/referralNotificationQueue', () => ({ enqueueReferralNotification: vi.fn() }));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  ReferralRuntimeUnavailableError: class ReferralRuntimeUnavailableError extends Error {},
  createReferralConversionService: vi.fn(),
  referralsAreEnabled: referralsAreEnabledMock,
}));

vi.mock('@/server/manufacturing/runtimeManufacturing', () => ({
  ManufacturingRuntimeUnavailableError: class ManufacturingRuntimeUnavailableError extends Error {},
  createManufacturingEventService: createManufacturingEventServiceMock,
}));

vi.mock('@/server/notifications/notificationQueue', () => ({ enqueueIssueNotification: vi.fn() }));

import { POST as postSupport } from '@/app/api/support/route';
import { GET as getIssueStatus } from '@/app/api/issue/status/route';
import { POST as postSafepay } from '@/app/api/webhooks/safepay/route';
import { POST as postPrintful } from '@/app/api/webhooks/printful/route';

function rendered(calls: unknown[][]): string {
  return calls.flat().map((value) => String(value)).join('\n');
}

function captureConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('residual route log privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: 'session-token' }) });
    referralsAreEnabledMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('support does not log an unknown service exception', async () => {
    const sentinel = 'support-sensitive-error-sentinel';
    createSupportServiceMock.mockReturnValue({ create: vi.fn().mockRejectedValue(new Error(sentinel)) });
    const consoleError = captureConsoleError();

    const response = await postSupport(new Request('https://issuedonce.shop/api/support', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Please help with this Issue.' }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Support request failed.' });
    expect(rendered(consoleError.mock.calls)).toContain('support request failed');
    expect(rendered(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('Issue status does not log an unknown repository exception', async () => {
    const sentinel = 'issue-status-sensitive-error-sentinel';
    createIssueStatusServiceMock.mockReturnValue({ forSession: vi.fn().mockRejectedValue(new Error(sentinel)) });
    const consoleError = captureConsoleError();

    const response = await getIssueStatus();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Issue status failed' });
    expect(rendered(consoleError.mock.calls)).toContain('issue status lookup failed');
    expect(rendered(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('Safepay webhook does not log an unknown processing exception', async () => {
    const sentinel = 'safepay-sensitive-error-sentinel';
    createPaymentServiceMock.mockReturnValue({ handleWebhook: vi.fn().mockRejectedValue(new Error(sentinel)) });
    const consoleError = captureConsoleError();

    const response = await postSafepay(new Request('https://issuedonce.shop/api/webhooks/safepay', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Webhook processing failed' });
    expect(rendered(consoleError.mock.calls)).toContain('safepay webhook processing failed');
    expect(rendered(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('Printful webhook does not log an unknown processing exception', async () => {
    const sentinel = 'printful-sensitive-error-sentinel';
    createManufacturingEventServiceMock.mockReturnValue({ handle: vi.fn().mockRejectedValue(new Error(sentinel)) });
    const consoleError = captureConsoleError();

    const response = await postPrintful(new Request('https://issuedonce.shop/api/webhooks/printful', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Webhook processing failed' });
    expect(rendered(consoleError.mock.calls)).toContain('printful webhook processing failed');
    expect(rendered(consoleError.mock.calls)).not.toContain(sentinel);
  });
});
