import { expect, test } from 'vitest';
import { resolveBuildReleaseId } from '@/server/runtime/releaseInfo';

test('GitHub-backed build identity prefers the checked-out git commit over stale manual RELEASE_ID', () => {
  const actualGitSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const staleReleaseId = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  expect(
    resolveBuildReleaseId(
      { RELEASE_ID: staleReleaseId },
      () => `${actualGitSha}\n`,
    ),
  ).toBe(actualGitSha);
});

test('build identity falls back to GITHUB_SHA when git metadata is unavailable', () => {
  const githubSha = 'cccccccccccccccccccccccccccccccccccccccc';
  expect(
    resolveBuildReleaseId(
      { GITHUB_SHA: githubSha },
      () => { throw new Error('no git metadata'); },
    ),
  ).toBe(githubSha);
});

test('manual RELEASE_ID remains the final identified-build fallback', () => {
  const manualReleaseId = 'dddddddddddddddddddddddddddddddddddddddd';
  expect(
    resolveBuildReleaseId(
      { RELEASE_ID: manualReleaseId },
      () => { throw new Error('no git metadata'); },
    ),
  ).toBe(manualReleaseId);
});
