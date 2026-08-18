export type CheckoutQuoteRecord = {
  id: string;
  experienceId: string;
  variantId: string;
  amountMinor: number;
  currency: string;
  expiresAt: Date;
};

export interface CheckoutQuoteRepository {
  findById(id: string): Promise<CheckoutQuoteRecord | null>;
}

export type CommerceVariant = {
  id: string;
  amountMinor: number;
  currency: string;
  available: boolean;
};

export type CreateCartInput = {
  variantId: string;
  quantity: 1;
  currency: string;
  metadata: Record<string, string>;
};

export interface CommerceGateway {
  getVariant(variantId: string, currency: string): Promise<CommerceVariant | null>;
  createCart(input: CreateCartInput): Promise<{ cartId: string; checkoutUrl: string }>;
}

export class CheckoutService {
  constructor(
    private readonly quoteRepository: CheckoutQuoteRepository,
    private readonly commerce: CommerceGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start(input: {
    quoteId: string;
    experienceId: string;
  }): Promise<{ checkoutUrl: string }> {
    const quote = await this.quoteRepository.findById(input.quoteId);
    if (!quote) throw new Error('Quote not found');

    if (quote.experienceId !== input.experienceId) {
      throw new Error('Quote does not belong to this experience');
    }

    if (quote.expiresAt.getTime() <= this.now().getTime()) {
      throw new Error('Quote expired');
    }

    const variant = await this.commerce.getVariant(quote.variantId, quote.currency);
    if (!variant || !variant.available) {
      throw new Error('Variant unavailable');
    }

    if (
      variant.id !== quote.variantId ||
      variant.amountMinor !== quote.amountMinor ||
      variant.currency !== quote.currency
    ) {
      throw new Error('Quote changed');
    }

    const cart = await this.commerce.createCart({
      variantId: quote.variantId,
      quantity: 1,
      currency: quote.currency,
      metadata: {
        io_experience_id: quote.experienceId,
        io_quote_id: quote.id,
      },
    });

    const checkoutUrl = new URL(cart.checkoutUrl);
    if (checkoutUrl.protocol !== 'https:') {
      throw new Error('Invalid checkout URL');
    }

    return { checkoutUrl: checkoutUrl.toString() };
  }
}
