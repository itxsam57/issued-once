import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

function routeFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(path));
    else if (entry.isFile() && entry.name === 'route.ts') found.push(path);
  }
  return found;
}

function rawCaughtErrorLogs(source: string): string[] {
  const calls = source.match(/console\.error\([\s\S]*?\);/g) ?? [];
  return calls.filter((call) => /,\s*(?:error|cause)\s*\);$/.test(call.trim()));
}

describe('route logging source contract', () => {
  test('no Next route serializes a raw caught exception into console.error', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const violations = routeFiles(appRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return rawCaughtErrorLogs(source).map((call) => ({
        route: relative(process.cwd(), path),
        call: call.replace(/\s+/g, ' ').slice(0, 240),
      }));
    });

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
