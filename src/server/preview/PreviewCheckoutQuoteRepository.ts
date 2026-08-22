import type { CheckoutQuoteRecord, CheckoutQuoteRepository } from '@/server/checkout/CheckoutService';
import { getPreviewStore } from './PreviewExperienceRepository';

export class PreviewCheckoutQuoteRepository implements CheckoutQuoteRepository {
  private readonly store = getPreviewStore();

  async create(record: CheckoutQuoteRecord): Promise<void> {
    this.store.checkoutQuotes.set(record.id, structuredClone(record));
  }

  async findById(id: string): Promise<CheckoutQuoteRecord | null> {
    const record = this.store.checkoutQuotes.get(id);
    return record ? structuredClone(record) : null;
  }
}
