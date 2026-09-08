import { expect, test, vi } from 'vitest';
import { PrintfulCatalogInspector } from '@/server/manufacturing/PrintfulCatalogInspector';

const teeSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const teeColors = [
  ['Ash', '#f0f1ea'],
  ['Black', '#0c0c0c'],
  ['Athletic Heather', '#cececc'],
  ['Navy', '#212642'],
  ['Forest', '#223e25'],
] as const;

const productList = {
  data: [
    { id: 71, name: 'Unisex Staple T-Shirt | Bella + Canvas 3001', brand: 'Bella + Canvas', model: '3001', is_discontinued: false },
    { id: 202, name: 'Classic Dad Cap | Yupoong 6245CM', brand: 'Yupoong', model: '6245CM', is_discontinued: false },
    { id: 303, name: 'Eco Tote Bag | Econscious EC8000', brand: 'Econscious', model: 'EC8000', is_discontinued: false },
  ],
  paging: { total: 3, offset: 0, limit: 100 },
};

const fullVariants: Record<number, Array<Record<string, unknown>>> = {
  71: teeSizes.flatMap((size, sizeIndex) => teeColors.map(([color, colorCode], colorIndex) => ({
    id: 7100 + sizeIndex * teeColors.length + colorIndex + 1,
    catalog_product_id: 71,
    name: `3001 (${color} / ${size})`,
    size,
    color,
    color_code: colorCode,
  }))),
  202: [
    { id: 20201, catalog_product_id: 202, name: '6245CM (Stone)', size: 'One size', color: 'Stone', color_code: '#d6bdad' },
    { id: 20202, catalog_product_id: 202, name: '6245CM (Black)', size: 'One size', color: 'Black', color_code: '#181717' },
  ],
  303: [
    { id: 30301, catalog_product_id: 303, name: 'EC8000 (Oyster)', size: 'One size', color: 'Oyster', color_code: '#edcea5' },
    { id: 30302, catalog_product_id: 303, name: 'EC8000 (Black)', size: 'One size', color: 'Black', color_code: '#111111' },
  ],
};

const details: Record<number, unknown> = {
  71: { id: 71, techniques: [{ key: 'dtg', display_name: 'DTG printing', is_default: true }], placements: [{ placement: 'front', technique: 'dtg' }] },
  202: { id: 202, techniques: [{ key: 'dtfilm', display_name: 'DTFlex', is_default: true }, { key: 'embroidery', display_name: 'Embroidery', is_default: false }], placements: [{ placement: 'front', technique: 'dtfilm' }] },
  303: { id: 303, techniques: [{ key: 'dtg', display_name: 'DTG printing', is_default: true }], placements: [{ placement: 'front', technique: 'dtg' }] },
};

const styles: Record<number, unknown[]> = {
  71: [{ placement: 'front', technique: 'dtg', print_area_width: 12, print_area_height: 16, dpi: 150 }],
  202: [{ placement: 'front', technique: 'dtfilm', print_area_width: 4, print_area_height: 2, dpi: 150 }],
  303: [{ placement: 'front', technique: 'dtg', print_area_width: 10, print_area_height: 12, dpi: 150 }],
};

function createFetch(variants: Record<number, Array<Record<string, unknown>>> = fullVariants) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer pf-secret-token' });
    if (url.includes('/v2/catalog-products?')) return Response.json(productList);
    const productId = Number(url.match(/catalog-products\/(\d+)/)?.[1]);
    if (url.endsWith('/catalog-variants?limit=100&offset=0')) return Response.json({ data: variants[productId], paging: { total: variants[productId].length, offset: 0, limit: 100 } });
    if (url.includes('/mockup-styles?')) return Response.json({ data: styles[productId], paging: { total: styles[productId].length, offset: 0, limit: 100 } });
    if (url.endsWith(`/v2/catalog-products/${productId}`)) return Response.json({ data: details[productId] });
    throw new Error(`unexpected ${url}`);
  });
}

test('inspects exactly all 34 required ISSUED ONCE variants with read-only Printful calls and no secret output', async () => {
  const fetchImpl = createFetch();
  const result = await new PrintfulCatalogInspector({ token: 'pf-secret-token', fetchImpl: fetchImpl as typeof fetch }).inspectIssuedOnce();

  expect(result.products.map((entry) => [entry.key, entry.product.id, entry.variants.length])).toEqual([
    ['tee', 71, 30], ['hat', 202, 2], ['tote', 303, 2],
  ]);
  expect(result.products[0]?.printAreas).toContainEqual({ placement: 'front', technique: 'dtg', widthPx: 1800, heightPx: 2400, dpi: 150, restrictedToVariants: null });
  expect(JSON.stringify(result)).not.toContain('pf-secret-token');
});

test('fails closed when even one required provider size/color combination is missing', async () => {
  const missingOne = { ...fullVariants, 71: fullVariants[71].slice(1) };
  const fetchImpl = createFetch(missingOne);
  await expect(new PrintfulCatalogInspector({ token: 'pf-secret-token', fetchImpl: fetchImpl as typeof fetch }).inspectIssuedOnce())
    .rejects.toThrow(/required.*variant|missing/i);
});
