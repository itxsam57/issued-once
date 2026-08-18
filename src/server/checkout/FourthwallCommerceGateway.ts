import type {
  CommerceGateway,
  CommerceVariant,
  CreateCartInput,
} from './CheckoutService';

type FourthwallCommerceGatewayOptions = {
  storefrontToken: string;
  shopDomain: string;
  fetchImpl?: typeof fetch;
};

type ProductResponse = {
  variants?: Array<{
    id?: string;
    unitPrice?: {
      value?: number;
      currency?: string;
    };
    stock?: {
      type?: string;
      inStock?: number;
    };
  }>;
};

type CartResponse = {
  id?: string;
};

function normalizeShopDomain(value: string): string {
  const domain = value.trim().toLowerCase();
  const parsed = new URL(`https://${domain}`);
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== domain ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Invalid Fourthwall shop domain');
  }
  return domain;
}

function toMinorUnits(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Invalid Fourthwall price');
  }
  return Math.round((value + Number.EPSILON) * 100);
}

export class FourthwallCommerceGateway implements CommerceGateway {
  private readonly storefrontToken: string;
  private readonly shopDomain: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FourthwallCommerceGatewayOptions) {
    if (!options.storefrontToken.trim()) {
      throw new Error('Fourthwall storefront token is required');
    }

    this.storefrontToken = options.storefrontToken.trim();
    this.shopDomain = normalizeShopDomain(options.shopDomain);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getVariant(
    productSlug: string,
    variantId: string,
    currency: string,
  ): Promise<CommerceVariant | null> {
    const url = new URL(
      `/v1/products/${encodeURIComponent(productSlug)}`,
      'https://storefront-api.fourthwall.com',
    );
    url.searchParams.set('storefront_token', this.storefrontToken);
    url.searchParams.set('currency', currency);

    const response = await this.fetchImpl(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Fourthwall product lookup failed');
    }

    const product = (await response.json()) as ProductResponse;
    const variant = product.variants?.find((candidate) => candidate.id === variantId);
    if (!variant) return null;

    const value = variant.unitPrice?.value;
    const providerCurrency = variant.unitPrice?.currency;
    if (typeof value !== 'number' || typeof providerCurrency !== 'string') {
      throw new Error('Fourthwall variant price is invalid');
    }

    const inStock = variant.stock?.inStock;
    return {
      id: variantId,
      amountMinor: toMinorUnits(value),
      currency: providerCurrency,
      available: typeof inStock === 'number' ? inStock > 0 : true,
    };
  }

  async createCart(input: CreateCartInput): Promise<{ cartId: string; checkoutUrl: string }> {
    const url = new URL('/v1/carts', 'https://storefront-api.fourthwall.com');
    url.searchParams.set('storefront_token', this.storefrontToken);
    url.searchParams.set('currency', input.currency);

    const response = await this.fetchImpl(url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ variantId: input.variantId, quantity: input.quantity }],
        metadata: input.metadata,
      }),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Fourthwall cart creation failed');
    }

    const cart = (await response.json()) as CartResponse;
    if (!cart.id) {
      throw new Error('Fourthwall cart response is invalid');
    }

    const checkout = new URL('/cart/checkout', `https://${this.shopDomain}`);
    checkout.searchParams.set('cartId', cart.id);
    checkout.searchParams.set('currency', input.currency);

    return {
      cartId: cart.id,
      checkoutUrl: checkout.toString(),
    };
  }
}
