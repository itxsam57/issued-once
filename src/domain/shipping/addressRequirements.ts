const REGION_REQUIRED_COUNTRIES = new Set(['US', 'CA', 'AU']);

export type ShippingAddressRequirements = {
  regionRequired: boolean;
  phoneRequired: false;
};

export function normalizeShippingCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

export function shippingAddressRequirements(countryCode: string): ShippingAddressRequirements {
  const normalized = normalizeShippingCountryCode(countryCode);
  return {
    regionRequired: REGION_REQUIRED_COUNTRIES.has(normalized),
    phoneRequired: false,
  };
}
