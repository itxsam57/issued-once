import { expect, test, vi } from 'vitest';
import { ResendOtpDeliveryGateway } from '@/server/contact/ResendOtpDeliveryGateway';

test('sends an idempotent minimal otp email through the verified ISSUED ONCE sender', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'email-123' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
  const gateway = new ResendOtpDeliveryGateway({
    apiKey: 're_test',
    from: 'ISSUED ONCE <access@issuedonce.shop>',
    fetchImpl: fetchImpl as typeof fetch,
  });

  const result = await gateway.sendOtp({
    email: 'sam@example.com',
    code: '123456',
    challengeId: 'challenge-1',
  });

  expect(result.providerMessageId).toBe('email-123');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.resend.com/emails');
  expect(init.method).toBe('POST');
  expect(init.headers).toMatchObject({
    Authorization: 'Bearer re_test',
    'Idempotency-Key': 'issued-once/otp/challenge-1',
  });
  expect(String(init.body)).toContain('123456');
  expect(String(init.body)).not.toContain('Printful');
});
