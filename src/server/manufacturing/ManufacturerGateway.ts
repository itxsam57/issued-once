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

export type ManufacturerPlacement = {
  areaWidth: number;
  areaHeight: number;
  width: number;
  height: number;
  top: number;
  left: number;
};

export interface ManufacturerGateway {
  createDraft(input: {
    externalId: string;
    variantId: number;
    artworkUrl: string;
    fileType: string;
    placement: ManufacturerPlacement;
    recipient: ManufacturerRecipient;
  }): Promise<{ providerOrderId: string; status: string }>;
  confirmDraft(providerOrderId: string): Promise<void>;
}
