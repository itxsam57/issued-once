import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

test('root layout keeps HTML requests on the server so Hostinger cannot bypass security response headers with prerender cache', async () => {
  const source = await readFile(new URL('../../src/app/layout.tsx', import.meta.url), 'utf8');

  expect(source).toMatch(/export const dynamic\s*=\s*['"]force-dynamic['"]/);
});
