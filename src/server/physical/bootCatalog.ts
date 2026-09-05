const TEE_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;
const TEE_COLORS = [
  { code: 'bone', name: 'Bone', swatch: '#f0f1ea' },
  { code: 'black', name: 'Black', swatch: '#0c0c0c' },
  { code: 'ash', name: 'Ash', swatch: '#cececc' },
  { code: 'navy', name: 'Navy', swatch: '#212642' },
  { code: 'forest', name: 'Forest', swatch: '#223e25' },
] as const;

const bootCatalog = {
  currency: 'USD',
  products: {
    tee: {
      slug: 'io-tee',
      variants: TEE_SIZES.flatMap((size) =>
        TEE_COLORS.map((color) => ({
          id: `io-tee-${size.toLowerCase()}-${color.code}`,
          size,
          colorName: color.name,
          colorSwatch: color.swatch,
          amountMinor: 3200,
          available: true,
        })),
      ),
    },
    hat: {
      slug: 'io-hat',
      variants: [
        { id: 'io-hat-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#d6bdad', amountMinor: 3400, available: true },
        { id: 'io-hat-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#181717', amountMinor: 3400, available: true },
      ],
    },
    tote: {
      slug: 'io-tote',
      variants: [
        { id: 'io-tote-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#edcea5', amountMinor: 3600, available: true },
        { id: 'io-tote-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#101010', amountMinor: 3600, available: true },
      ],
    },
  },
} as const;

export const ISSUED_ONCE_BOOT_CATALOG_JSON = JSON.stringify(bootCatalog);
