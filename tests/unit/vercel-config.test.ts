import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Vercel deployment configuration', () => {
  it('pins the framework to Next.js when the production branch cannot auto-detect the app', () => {
    const configPath = resolve(process.cwd(), 'vercel.json');

    expect(
      existsSync(configPath),
      'vercel.json must exist so Vercel does not inherit framework detection from the app-less production branch',
    ).toBe(true);

    if (!existsSync(configPath)) {
      return;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      framework?: string | null;
    };

    expect(config.framework).toBe('nextjs');
  });
});
