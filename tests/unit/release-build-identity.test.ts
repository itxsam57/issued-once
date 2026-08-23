import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { resolveBuildReleaseId } from '@/server/runtime/releaseInfo';

const sha = '8a58a0e30fd7c9cc231b4335ebb25261bdd318c0';

test('release identity prefers an explicit frozen release id', () => {
  expect(resolveBuildReleaseId(
    { RELEASE_ID: `  ${sha}  ` },
    () => 'should-not-run',
  )).toBe(sha);
});

test('release identity falls back to the checked-out git commit', () => {
  expect(resolveBuildReleaseId({}, () => `${sha}\n`)).toBe(sha);
});

test('release identity fails the build closed when neither configured nor discoverable', () => {
  expect(() => resolveBuildReleaseId({}, () => { throw new Error('git unavailable'); }))
    .toThrow(/release identity/i);
});

test('Next build id and release health use the same captured release identity', () => {
  const config = readFileSync('next.config.ts', 'utf8');
  const route = readFileSync('src/app/api/health/release/route.ts', 'utf8');

  expect(config).toContain('resolveBuildReleaseId');
  expect(config).toContain('generateBuildId');
  expect(config).toContain('ISSUED_ONCE_RELEASE_ID');
  expect(route).toContain('ISSUED_ONCE_RELEASE_ID');
});
