// Audited against the live Printful catalog on 2026-09-05.
// This is non-secret provider truth. PRINTFUL_VARIANT_MAP_JSON remains an optional override.
const teePlacement = {
  fileType: 'front',
  printArea: { width: 1800, height: 2400, dpi: 150 },
  position: { width: 900, height: 1350, top: 300, left: 450 },
} as const;

const hatPlacement = {
  fileType: 'front_dtf_hat',
  printArea: { width: 1500, height: 600, dpi: 300 },
  position: { width: 900, height: 600, top: 0, left: 300 },
} as const;

const totePlacement = {
  fileType: 'front',
  printArea: { width: 1500, height: 1500, dpi: 150 },
  position: { width: 900, height: 1350, top: 75, left: 300 },
} as const;

export const ISSUED_ONCE_PRINTFUL_VARIANT_MAP = {
  'tee:XS:Bone': { variantId: 9529, ...teePlacement },
  'tee:XS:Black': { variantId: 9527, ...teePlacement },
  'tee:XS:Ash': { variantId: 9561, ...teePlacement },
  'tee:XS:Navy': { variantId: 9546, ...teePlacement },
  'tee:XS:Forest': { variantId: 9563, ...teePlacement },
  'tee:S:Bone': { variantId: 4026, ...teePlacement },
  'tee:S:Black': { variantId: 4016, ...teePlacement },
  'tee:S:Ash': { variantId: 6948, ...teePlacement },
  'tee:S:Navy': { variantId: 4111, ...teePlacement },
  'tee:S:Forest': { variantId: 8451, ...teePlacement },
  'tee:M:Bone': { variantId: 4027, ...teePlacement },
  'tee:M:Black': { variantId: 4017, ...teePlacement },
  'tee:M:Ash': { variantId: 6949, ...teePlacement },
  'tee:M:Navy': { variantId: 4112, ...teePlacement },
  'tee:M:Forest': { variantId: 8452, ...teePlacement },
  'tee:L:Bone': { variantId: 4028, ...teePlacement },
  'tee:L:Black': { variantId: 4018, ...teePlacement },
  'tee:L:Ash': { variantId: 6950, ...teePlacement },
  'tee:L:Navy': { variantId: 4113, ...teePlacement },
  'tee:L:Forest': { variantId: 8453, ...teePlacement },
  'tee:XL:Bone': { variantId: 4029, ...teePlacement },
  'tee:XL:Black': { variantId: 4019, ...teePlacement },
  'tee:XL:Ash': { variantId: 6951, ...teePlacement },
  'tee:XL:Navy': { variantId: 4114, ...teePlacement },
  'tee:XL:Forest': { variantId: 8454, ...teePlacement },
  'tee:2XL:Bone': { variantId: 4030, ...teePlacement },
  'tee:2XL:Black': { variantId: 4020, ...teePlacement },
  'tee:2XL:Ash': { variantId: 6952, ...teePlacement },
  'tee:2XL:Navy': { variantId: 4115, ...teePlacement },
  'tee:2XL:Forest': { variantId: 8455, ...teePlacement },
  'hat:OS:Bone': { variantId: 7859, ...hatPlacement },
  'hat:OS:Black': { variantId: 7854, ...hatPlacement },
  'tote:OS:Bone': { variantId: 10458, ...totePlacement },
  'tote:OS:Black': { variantId: 10457, ...totePlacement },
} as const;

export const ISSUED_ONCE_PRINTFUL_VARIANT_MAP_JSON = JSON.stringify(ISSUED_ONCE_PRINTFUL_VARIANT_MAP);
