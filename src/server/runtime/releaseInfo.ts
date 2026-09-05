import { execFileSync } from 'node:child_process';

type ReleaseEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveBuildReleaseId(
  env: ReleaseEnvironment = process.env,
  readGitSha: () => string = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }),
): string {
  try {
    const gitSha = readGitSha().trim();
    if (gitSha) return gitSha;
  } catch {
    // Git metadata is optional for non-Git deployment paths; fallbacks are handled below.
  }

  const githubSha = env.GITHUB_SHA?.trim();
  if (githubSha) return githubSha;

  const releaseId = env.RELEASE_ID?.trim();
  if (releaseId) return releaseId;

  throw new Error('Release identity could not be resolved from git HEAD, GITHUB_SHA, or RELEASE_ID');
}
