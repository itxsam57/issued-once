import { expect, test, vi } from 'vitest';
import { ResendOtpDeliveryGateway } from '@/server/contact/ResendOtpDeliveryGateway';

test('sends an idempotent minimal otp email through the verified ISSUED ONCE sender with request tag', async () => {
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
    challengeId: '6c6ba8d3-1111-2222-3333-444444444444',
  });

  expect(result.providerMessageId).toBe('email-123');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.resend.com/emails');
  expect(init.method).toBe('POST');
  expect(init.headers).toMatchObject({
    Authorization: 'Bearer re_test',
    'Idempotency-Key': 'issued-once/otp/6c6ba8d3-1111-2222-3333-444444444444',
  });
  const body = JSON.parse(String(init.body)) as { subject: string; text: string };
  expect(body.subject).toBe('Your ISSUED ONCE code · 6C6BA8D3');
  expect(body.text).toContain('123456');
  expect(body.text).toContain('Request 6C6BA8D3');
  expect(String(init.body)).not.toContain('Printful');
});
