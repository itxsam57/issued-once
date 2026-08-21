import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { ReferralNotificationService } from '@/server/referrals/ReferralNotificationService';

const previousKey = process.env.QUIZ_ENCRYPTION_KEY_V1;
const now = new Date('2026-08-21T12:30:00.000Z');
const conversionId = '22222222-2222-4222-8222-222222222222';

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.from('r'.repeat(32), 'utf8').toString('base64');
});

afterAll(() => {
  if (previousKey === undefined) delete process.env.QUIZ_ENCRYPTION_KEY_V1;
  else process.env.QUIZ_ENCRYPTION_KEY_V1 = previousKey;
});

async function setup(reserved = true) {
  const encryptedEmail = await encryptPrivatePayload({ email: 'creator@example.com' });
  const repository = {
    loadNotificationInput: vi.fn().mockResolvedValue({
      conversionId,
      creatorId: '33333333-3333-4333-8333-333333333333',
      encryptedEmail,
      rewardAmountMinor: 972,
      currency: 'USD',
      pendingBalanceMinor: 3472,
      availableBalanceMinor: 1500,
    }),
    reserveNotification: vi.fn().mockResolvedValue(reserved),
    markNotificationSent: vi.fn().mockResolvedValue(undefined),
    markNotificationFailed: vi.fn().mockResolvedValue(undefined),
  };
  const gateway = {
    send: vi.fn().mockResolvedValue({ providerMessageId: 'email-1' }),
  };
  const service = new ReferralNotificationService(
    repository,
    gateway,
    () => now,
    () => '44444444-4444-4444-8444-444444444444',
  );
  return { service, repository, gateway };
}

test('SALE email contains only creator sale reward and balance facts with stable idempotency', async () => {
  const { service, repository, gateway } = await setup();

  await expect(service.send(conversionId, 'SALE')).resolves.toEqual({ sent: true });

  expect(repository.reserveNotification).toHaveBeenCalledWith({
    id: '44444444-4444-4444-8444-444444444444',
    conversionId,
    kind: 'SALE',
    now,
  });
  expect(gateway.send).toHaveBeenCalledTimes(1);
  const message = vi.mocked(gateway.send).mock.calls[0]?.[0];
  expect(message).toEqual(expect.objectContaining({
    to: 'creator@example.com',
    idempotencyKey: `issued-once/referral/${conversionId}/SALE`,
  }));
  expect(message?.text).toMatch(/sale came through your referral/i);
  expect(message?.text).toContain('$9.72');
  expect(message?.text).toContain('$34.72');
  expect(message?.text).toContain('$15.00');
  expect(JSON.stringify(message)).not.toMatch(
    /buyer-private@example\.com|1 Hidden Road|questionnaire|shipping|artwork|issue code/i,
  );
  expect(repository.markNotificationSent).toHaveBeenCalledWith(
    conversionId,
    'SALE',
    'email-1',
    now,
  );
});

test('replay after a sent notification is a no-op and cannot send a second creator email', async () => {
  const { service, gateway } = await setup(false);

  await expect(service.send(conversionId, 'SALE')).resolves.toEqual({ sent: false });
  expect(gateway.send).not.toHaveBeenCalled();
});

test('failed creator delivery records failure so queue replay can retry safely', async () => {
  const { service, repository, gateway } = await setup();
  gateway.send.mockRejectedValue(new Error('provider unavailable'));

  await expect(service.send(conversionId, 'SALE')).rejects.toThrow('provider unavailable');
  expect(repository.markNotificationFailed).toHaveBeenCalledWith(
    conversionId,
    'SALE',
    'Error',
    now,
  );
});
