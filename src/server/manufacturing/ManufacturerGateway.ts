export type ManufacturerRecipient = {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  stateCode: string;
  countryCode: string;
  zip: string;
};

export interface ManufacturerGateway {
  createDraft(input: {
    externalId: string;
    variantId: number;
    artworkUrl: string;
    fileType: string;
    recipient: ManufacturerRecipient;
  }): Promise<{ providerOrderId: string; status: string }>;
  confirmDraft(providerOrderId: string): Promise<void>;
}
