import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { resolveBuildReleaseId } from '@/server/runtime/releaseInfo';

const sha = '8a58a0e30fd7c9cc231b4335ebb25261bdd318c0';
const staleSha = '1111111111111111111111111111111111111111';

test('release identity prefers the checked-out git commit over a stale configured release id', () => {
  expect(resolveBuildReleaseId(
    { RELEASE_ID: staleSha },
    () => `${sha}\n`,
  )).toBe(sha);
});

test('release identity falls back to GitHub SHA when git metadata is unavailable', () => {
  expect(resolveBuildReleaseId(
    { GITHUB_SHA: `  ${sha}  ` },
    () => { throw new Error('git unavailable'); },
  )).toBe(sha);
});

test('release identity falls back to configured release id when git and GitHub SHA are unavailable', () => {
  expect(resolveBuildReleaseId(
    { RELEASE_ID: `  ${sha}  ` },
    () => { throw new Error('git unavailable'); },
  )).toBe(sha);
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
