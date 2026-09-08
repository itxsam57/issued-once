import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';

test('root layout keeps HTML requests on the server so Hostinger cannot bypass security response headers with prerender cache', async () => {
  const source = await readFile(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

  expect(source).toMatch(/export const dynamic\s*=\s*['"]force-dynamic['"]/);
});
