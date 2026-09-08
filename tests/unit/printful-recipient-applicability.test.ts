import { expect, test, vi } from 'vitest';
import { PrintfulGateway } from '@/server/manufacturing/PrintfulGateway';

test('omits blank provider-optional recipient fields for destinations that do not require them', async () => {
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://api.printful.com/orders/%40IO-GB-OPTIONAL') {
      return new Response(JSON.stringify({ code: 404 }), { status: 404 });
    }

    expect(url).toBe('https://api.printful.com/orders?confirm=0&update_existing=true');
    const body = JSON.parse(String(init?.body));
    expect(body.recipient).toEqual({
      name: 'Sam Example',
      email: 'sam@example.com',
      address1: '1 Quiet Street',
      city: 'London',
      country_code: 'GB',
      zip: 'SW1A 1AA',
    });
    expect(body.recipient).not.toHaveProperty('phone');
    expect(body.recipient).not.toHaveProperty('address2');
    expect(body.recipient).not.toHaveProperty('state_code');

    return new Response(JSON.stringify({ code: 200, result: { id: 987654, status: 'draft' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });
  await expect(gateway.createDraft({
    externalId: 'IO-GB-OPTIONAL',
    variantId: 4012,
    artworkUrl: 'https://art.example/issue.png',
    fileType: 'front',
    placement: { areaWidth: 1800, areaHeight: 2400, width: 900, height: 1350, top: 300, left: 450 },
    recipient: {
      name: 'Sam Example',
      email: 'sam@example.com',
      phone: '',
      address1: '1 Quiet Street',
      address2: '',
      city: 'London',
      stateCode: '',
      countryCode: 'GB',
      zip: 'SW1A 1AA',
    },
  })).resolves.toEqual({ providerOrderId: '987654', status: 'draft' });
});
