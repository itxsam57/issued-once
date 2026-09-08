import { expect, test, vi } from 'vitest';
import { ReferralLaunchOutreachService } from '@/server/referrals/ReferralLaunchOutreachService';

const encryptedEmail = {
  version: 1 as const,
  keyVersion: 'v1' as const,
  iv: 'iv',
  ciphertext: 'ciphertext',
  tag: 'tag',
};

function setup(reserved = true) {
  const repository = {
    listActiveCreatorsForOutreach: vi.fn().mockResolvedValue([
      {
        creatorId: 'creator-1',
        displayName: 'Creator One',
        normalizedCode: 'CREATOR-ONE',
        encryptedEmail,
      },
    ]),
    reserveOutreach: vi.fn().mockResolvedValue(reserved),
    markOutreachSent: vi.fn().mockResolvedValue(undefined),
    markOutreachFailed: vi.fn().mockResolvedValue(undefined),
  };
  const gateway = {
    send: vi.fn().mockResolvedValue({ providerMessageId: 'resend-1' }),
  };
  const decrypt = vi.fn().mockResolvedValue({ email: 'creator@example.com' });
  const service = new ReferralLaunchOutreachService({
    repository,
    gateway,
    appOrigin: 'https://issuedonce.shop',
    decrypt,
    now: () => new Date('2026-08-27T12:00:00.000Z'),
    createDeliveryId: () => 'delivery-1',
  });
  return { service, repository, gateway, decrypt };
}

test('launch outreach sends an active creator their referral link once without exposing private contact data', async () => {
  const { service, repository, gateway, decrypt } = setup();

  const result = await service.sendBatch({ campaign: 'launch-v1', limit: 50 });

  expect(repository.listActiveCreatorsForOutreach).toHaveBeenCalledWith('launch-v1', 50);
  expect(repository.reserveOutreach).toHaveBeenCalledWith({
    id: 'delivery-1',
    creatorId: 'creator-1',
    campaign: 'launch-v1',
    now: new Date('2026-08-27T12:00:00.000Z'),
  });
  expect(decrypt).toHaveBeenCalledWith(encryptedEmail);
  expect(gateway.send).toHaveBeenCalledWith(expect.objectContaining({
    to: 'creator@example.com',
    subject: expect.stringMatching(/ISSUED ONCE.*live/i),
    text: expect.stringContaining('https://issuedonce.shop/r/CREATOR-ONE'),
    idempotencyKey: 'issued-once/referral-outreach/launch-v1/creator-1',
  }));
  expect(gateway.send.mock.calls[0][0].text).toMatch(/no longer want to participate|deactivate/i);
  expect(repository.markOutreachSent).toHaveBeenCalledWith(
    'creator-1',
    'launch-v1',
    'resend-1',
    expect.any(Date),
  );
  expect(result).toEqual({ considered: 1, sent: 1, skipped: 0, failed: 0 });
  expect(JSON.stringify(result)).not.toMatch(/creator@example\.com|ciphertext/i);
});

test('already-sent launch outreach is skipped instead of sending a duplicate email', async () => {
  const { service, repository, gateway, decrypt } = setup(false);

  const result = await service.sendBatch({ campaign: 'launch-v1', limit: 50 });

  expect(repository.reserveOutreach).toHaveBeenCalledTimes(1);
  expect(decrypt).not.toHaveBeenCalled();
  expect(gateway.send).not.toHaveBeenCalled();
  expect(repository.markOutreachSent).not.toHaveBeenCalled();
  expect(result).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
});

test('one creator delivery failure is recorded and does not turn the batch into an unsafe retry storm', async () => {
  const { service, repository, gateway } = setup();
  gateway.send.mockRejectedValueOnce(new Error('provider unavailable'));

  const result = await service.sendBatch({ campaign: 'launch-v1', limit: 50 });

  expect(repository.markOutreachFailed).toHaveBeenCalledWith(
    'creator-1',
    'launch-v1',
    'Error',
    expect.any(Date),
  );
  expect(result).toEqual({ considered: 1, sent: 0, skipped: 0, failed: 1 });
});
