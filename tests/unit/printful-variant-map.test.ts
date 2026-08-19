import { expect, test } from 'vitest';
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
])('rejects unsafe Printful mapping %#', (value) => {
  expect(() => new PrintfulVariantMap(JSON.stringify({ 'tee:M:Black': value }))).toThrow();
});
