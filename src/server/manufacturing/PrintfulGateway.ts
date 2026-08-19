import type { ManufacturerGateway } from './ManufacturerGateway';

type Options = {
  token: string;
  storeId?: string;
  fetchImpl?: typeof fetch;
};

type PrintfulOrderResponse = {
  code?: number;
  result?: {
    id?: number | string;
    status?: string;
  };
};

export class PrintfulGateway implements ManufacturerGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Options) {
    if (!options.token.trim()) throw new Error('Printful token is required');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.options.storeId?.trim()) headers['X-PF-Store-Id'] = this.options.storeId.trim();
    return headers;
  }

  private parseDraft(payload: PrintfulOrderResponse, context: string) {
    const id = payload.result?.id;
    const status = payload.result?.status?.trim();
    if ((typeof id !== 'number' && typeof id !== 'string') || !status) {
      throw new Error(`${context} response is invalid`);
    }
    if (!['draft', 'failed', 'onhold'].includes(status.toLowerCase())) {
      throw new Error(`Existing Printful order state is not draft-safe: ${status}`);
    }
    return { providerOrderId: String(id), status };
  }

  async createDraft(input: Parameters<ManufacturerGateway['createDraft']>[0]) {
    const artwork = new URL(input.artworkUrl);
    if (artwork.protocol !== 'https:') throw new Error('Printful artwork URL must use HTTPS');
    if (!Number.isSafeInteger(input.variantId) || input.variantId <= 0) throw new Error('Printful variant is invalid');
    const externalId = input.externalId.trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(externalId)) throw new Error('Printful external ID is invalid');

    const p = input.placement;
    if (
      ![p.areaWidth, p.areaHeight, p.width, p.height].every((value) => Number.isSafeInteger(value) && value > 0) ||
      ![p.top, p.left].every((value) => Number.isSafeInteger(value) && value >= 0) ||
      p.left + p.width > p.areaWidth ||
      p.top + p.height > p.areaHeight
    ) {
      throw new Error('Printful placement is invalid');
    }

    const lookup = await this.fetchImpl(
      `https://api.printful.com/orders/${encodeURIComponent(`@${externalId}`)}`,
      {
        method: 'GET',
        headers: this.headers(),
        cache: 'no-store',
      },
    );
    if (lookup.ok) {
      return this.parseDraft((await lookup.json()) as PrintfulOrderResponse, 'Printful order lookup');
    }
    if (lookup.status !== 404) {
      throw new Error('Printful draft lookup failed');
    }

    const response = await this.fetchImpl('https://api.printful.com/orders?confirm=0&update_existing=true', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        external_id: externalId,
        recipient: {
          name: input.recipient.name,
          email: input.recipient.email,
          phone: input.recipient.phone,
          address1: input.recipient.address1,
          address2: input.recipient.address2,
          city: input.recipient.city,
          state_code: input.recipient.stateCode,
          country_code: input.recipient.countryCode,
          zip: input.recipient.zip,
        },
        items: [{
          variant_id: input.variantId,
          quantity: 1,
          files: [{
            type: input.fileType,
            url: artwork.toString(),
            position: {
              area_width: p.areaWidth,
              area_height: p.areaHeight,
              width: p.width,
              height: p.height,
              top: p.top,
              left: p.left,
              limit_to_print_area: true,
            },
          }],
        }],
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Printful draft creation failed');
    return this.parseDraft((await response.json()) as PrintfulOrderResponse, 'Printful draft');
  }

  async confirmDraft(providerOrderId: string): Promise<void> {
    const orderId = providerOrderId.trim();
    if (!/^\d+$/.test(orderId)) throw new Error('Printful order ID is invalid');
    const response = await this.fetchImpl(`https://api.printful.com/orders/${encodeURIComponent(orderId)}/confirm`, {
      method: 'POST',
      headers: this.headers(),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Printful order confirmation failed');
    const payload = (await response.json()) as PrintfulOrderResponse;
    if (!payload.result?.id) throw new Error('Printful confirmation response is invalid');
  }
}
