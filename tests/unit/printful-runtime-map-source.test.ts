import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('design manufacturing and Owner OS runtimes use the shared audited map resolver instead of requiring an env-only map', () => {
  const design = readFileSync('src/server/design/runtimeDesign.ts', 'utf8');
  const manufacturing = readFileSync('src/server/manufacturing/runtimeManufacturing.ts', 'utf8');
  const ownerOs = readFileSync('src/server/ops/runtimeOwnerOs.ts', 'utf8');

  for (const source of [design, manufacturing, ownerOs]) {
    expect(source).toContain('readPrintfulVariantMapJson');
    expect(source).not.toContain("env('PRINTFUL_VARIANT_MAP_JSON')");
    expect(source).not.toContain('process.env.PRINTFUL_VARIANT_MAP_JSON?.trim()');
  }
});
