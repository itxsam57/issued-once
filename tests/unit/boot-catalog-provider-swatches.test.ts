import { expect, test } from 'vitest';
import { ISSUED_ONCE_BOOT_CATALOG_JSON } from '@/server/physical/bootCatalog';

test('boot catalog preserves public color names while using exact verified Printful swatches', () => {
  const catalog = JSON.parse(ISSUED_ONCE_BOOT_CATALOG_JSON) as {
    products: Record<string, { variants: Array<{ colorName: string; colorSwatch: string | null }> }>;
  };

  const swatches = (objectType: string) => Object.fromEntries(
    catalog.products[objectType].variants.map((variant) => [variant.colorName, variant.colorSwatch]),
  );

  expect(swatches('tee')).toEqual({
    Bone: '#f0f1ea',
    Black: '#0c0c0c',
    Ash: '#cececc',
    Navy: '#212642',
    Forest: '#223e25',
  });
  expect(swatches('hat')).toEqual({ Bone: '#d6bdad', Black: '#181717' });
  expect(swatches('tote')).toEqual({ Bone: '#edcea5', Black: '#101010' });
});
