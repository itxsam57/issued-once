import { expect, test, vi } from 'vitest';
import { PrintfulGateway } from '@/server/manufacturing/PrintfulGateway';

const recipient = {
  name: 'Sam Example', email: 'sam@example.com', phone: '+44 7000 000000',
  address1: '1 Quiet Street', address2: '', city: 'London', stateCode: 'London',
  countryCode: 'GB', zip: 'SW1A 1AA',
};

const draftInput = {
  externalId: 'IO-ABCD-EFGH', variantId: 4012, artworkUrl: 'https://blob.example/issue.png',
  fileType: 'front',
  placement: { areaWidth: 1800, areaHeight: 2400, width: 900, height: 1350, top: 300, left: 450 },
  recipient,
};

const readyDraft = {
  code: 200,
  result: {
    id: 987654,
    status: 'draft',
    items: [{
      id: 1,
      files: [
        { type: 'front', id: 10, status: 'ok' },
        { type: 'preview', id: 11, status: 'waiting' },
      ],
    }],
  },
};

test('checks Issue external ID before creating an unconfirmed Printful order with exact variant, art, and placement', async () => {
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://api.printful.com/orders/%40IO-ABCD-EFGH') {
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({ code: 404 }), { status: 404 });
    }

    expect(url).toBe('https://api.printful.com/orders?confirm=0&update_existing=true');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer pf-token',
      'X-PF-Store-Id': 'store-123',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      external_id: 'IO-ABCD-EFGH',
      recipient: {
        name: 'Sam Example', email: 'sam@example.com', phone: '+44 7000 000000',
        address1: '1 Quiet Street', address2: '', city: 'London', state_code: 'London',
        country_code: 'GB', zip: 'SW1A 1AA',
      },
      items: [{
        variant_id: 4012,
        quantity: 1,
        files: [{
          type: 'front',
          url: 'https://blob.example/issue.png',
          position: {
            area_width: 1800,
            area_height: 2400,
            width: 900,
            height: 1350,
            top: 300,
            left: 450,
            limit_to_print_area: true,
          },
        }],
      }],
    });
    return new Response(JSON.stringify({ code: 200, result: { id: 987654, status: 'draft' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const gateway = new PrintfulGateway({ token: 'pf-token', storeId: 'store-123', fetchImpl: fetchImpl as typeof fetch });
  expect(await gateway.createDraft(draftInput)).toEqual({ providerOrderId: '987654', status: 'draft' });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('recovers an existing Printful draft by Issue external ID without creating another remote order', async () => {
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toBe('https://api.printful.com/orders/%40IO-ABCD-EFGH');
    expect(init?.method).toBe('GET');
    return new Response(JSON.stringify({ code: 200, result: { id: 987654, status: 'draft' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });
  await expect(gateway.createDraft(draftInput)).resolves.toEqual({ providerOrderId: '987654', status: 'draft' });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('fails closed when the Issue external ID already points at a non-draft Printful state', async () => {
  for (const status of ['pending', 'failed', 'onhold']) {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ code: 200, result: { id: 987654, status } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });

    await expect(gateway.createDraft(draftInput)).rejects.toThrow(/existing Printful order state/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  }
});

test('rechecks the Printful draft and confirms only after every printable file is processed', async () => {
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://api.printful.com/orders/987654') {
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify(readyDraft), { status: 200 });
    }
    expect(url).toBe('https://api.printful.com/orders/987654/confirm');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
    return new Response(JSON.stringify({ code: 200, result: { id: 987654, status: 'pending' } }), { status: 200 });
  });
  const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });
  await expect(gateway.confirmDraft('987654')).resolves.toBeUndefined();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('refuses to charge while a printable file is still waiting', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    code: 200,
    result: {
      id: 987654,
      status: 'draft',
      items: [{ id: 1, files: [{ type: 'front', id: 10, status: 'waiting' }] }],
    },
  }), { status: 200 }));
  const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });

  await expect(gateway.confirmDraft('987654')).rejects.toThrow(/file.*not ready|processing/i);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('refuses to charge when a printable file failed processing or cannot be proven ready', async () => {
  for (const files of [
    [{ type: 'front', id: 10, status: 'failed' }],
    [{ type: 'front', id: 10 }],
    [],
  ]) {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      result: { id: 987654, status: 'draft', items: [{ id: 1, files }] },
    }), { status: 200 }));
    const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });

    await expect(gateway.confirmDraft('987654')).rejects.toThrow(/file.*not ready|processing/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  }
});

test('refuses to charge if the provider order is no longer a draft at confirmation time', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    ...readyDraft,
    result: { ...readyDraft.result, status: 'pending' },
  }), { status: 200 }));
  const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });

  await expect(gateway.confirmDraft('987654')).rejects.toThrow(/draft/i);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('does not accept a 200 confirmation response unless Printful reports pending', async () => {
  for (const status of ['draft', 'failed', 'onhold']) {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === 'https://api.printful.com/orders/987654') {
        return new Response(JSON.stringify(readyDraft), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 200, result: { id: 987654, status } }), { status: 200 });
    });
    const gateway = new PrintfulGateway({ token: 'pf-token', fetchImpl: fetchImpl as typeof fetch });

    await expect(gateway.confirmDraft('987654')).rejects.toThrow(/confirmation.*pending|confirmation.*state/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  }
});
