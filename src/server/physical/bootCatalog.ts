const TEE_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;
const TEE_COLORS = [
  { code: 'bone', name: 'Bone', swatch: '#e8e0cf' },
  { code: 'black', name: 'Black', swatch: '#171713' },
  { code: 'ash', name: 'Ash', swatch: '#aaa69d' },
  { code: 'navy', name: 'Navy', swatch: '#202834' },
  { code: 'forest', name: 'Forest', swatch: '#344238' },
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
        { id: 'io-hat-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3400, available: true },
        { id: 'io-hat-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#171713', amountMinor: 3400, available: true },
      ],
    },
    tote: {
      slug: 'io-tote',
      variants: [
        { id: 'io-tote-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3600, available: true },
        { id: 'io-tote-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#171713', amountMinor: 3600, available: true },
      ],
    },
  },
} as const;

export const ISSUED_ONCE_BOOT_CATALOG_JSON = JSON.stringify(bootCatalog);
