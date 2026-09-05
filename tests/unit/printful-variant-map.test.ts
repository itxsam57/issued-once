import { expect, test } from 'vitest';
import * as PrintfulVariantModule from '@/server/manufacturing/PrintfulVariantMap';
import { PrintfulVariantMap } from '@/server/manufacturing/PrintfulVariantMap';

const configured = JSON.stringify({
  'tee:M:Black': {
    variantId: 4012,
    fileType: 'front',
    printArea: { width: 1800, height: 2400, dpi: 150 },
    position: { width: 900, height: 1350, top: 300, left: 450 },
  },
});

test('requires exact provider variant plus sampled print-area placement', () => {
  expect(new PrintfulVariantMap(configured).resolve({
    objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
  })).toMatchObject({
    variantId: 4012,
    fileType: 'front',
    printArea: { width: 1800, height: 2400, dpi: 150 },
    position: { width: 900, height: 1350, top: 300, left: 450 },
  });
});

test.each([
  [{ variantId: 4012, fileType: 'front' }, /printArea|position/i],
  [{ variantId: 4012, fileType: 'front', printArea: { width: 1800, height: 2400, dpi: 150 }, position: { width: 1900, height: 1350, top: 0, left: 0 } }, /invalid|too_big|custom/i],
  [{ variantId: 4012, fileType: 'front', printArea: { width: 1800, height: 2400, dpi: 150 }, position: { width: 900, height: 1350, top: 1200, left: 450 } }, /invalid|too_big|custom/i],
])('rejects unsafe Printful mapping %#', (value, expected) => {
  expect(() => new PrintfulVariantMap(JSON.stringify({ 'tee:M:Black': value }))).toThrow(expected);
});

test('uses the audited built-in 34-variant Printful map when no environment override is configured', () => {
  const moduleExports = PrintfulVariantModule as unknown as Record<string, unknown>;
  const readMap = moduleExports.readPrintfulVariantMapJson as ((env?: NodeJS.ProcessEnv) => string) | undefined;
  expect(typeof readMap).toBe('function');

  const override = JSON.stringify({ 'tee:M:Black': JSON.parse(configured)['tee:M:Black'] });
  expect(readMap!({ NODE_ENV: 'test', PRINTFUL_VARIANT_MAP_JSON: override })).toBe(override);

  const map = new PrintfulVariantMap(readMap!({ NODE_ENV: 'test' }));
  const expectedVariantIds: Record<string, number> = {
    'hat:OS:Black': 7854,
    'hat:OS:Bone': 7859,
    'tee:2XL:Ash': 6952,
    'tee:2XL:Black': 4020,
    'tee:2XL:Bone': 4030,
    'tee:2XL:Forest': 8455,
    'tee:2XL:Navy': 4115,
    'tee:L:Ash': 6950,
    'tee:L:Black': 4018,
    'tee:L:Bone': 4028,
    'tee:L:Forest': 8453,
    'tee:L:Navy': 4113,
    'tee:M:Ash': 6949,
    'tee:M:Black': 4017,
    'tee:M:Bone': 4027,
    'tee:M:Forest': 8452,
    'tee:M:Navy': 4112,
    'tee:S:Ash': 6948,
    'tee:S:Black': 4016,
    'tee:S:Bone': 4026,
    'tee:S:Forest': 8451,
    'tee:S:Navy': 4111,
    'tee:XL:Ash': 6951,
    'tee:XL:Black': 4019,
    'tee:XL:Bone': 4029,
    'tee:XL:Forest': 8454,
    'tee:XL:Navy': 4114,
    'tee:XS:Ash': 9561,
    'tee:XS:Black': 9527,
    'tee:XS:Bone': 9529,
    'tee:XS:Forest': 9563,
    'tee:XS:Navy': 9546,
    'tote:OS:Black': 10457,
    'tote:OS:Bone': 10458,
  };

  expect(Object.keys(expectedVariantIds)).toHaveLength(34);
  for (const [key, variantId] of Object.entries(expectedVariantIds)) {
    const [objectType, sizeCode, ...colorParts] = key.split(':');
    expect(map.resolve({ objectType, sizeCode, colorCode: colorParts.join(':') }).variantId).toBe(variantId);
  }
});
