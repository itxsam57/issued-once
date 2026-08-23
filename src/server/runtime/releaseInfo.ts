import { execFileSync } from 'node:child_process';

type ReleaseEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveBuildReleaseId(
  env: ReleaseEnvironment = process.env,
  readGitSha: () => string = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }),
): string {
  const explicit = env.RELEASE_ID?.trim() || env.GITHUB_SHA?.trim();
  if (explicit) return explicit;

  try {
    const gitSha = readGitSha().trim();
    if (gitSha) return gitSha;
  } catch {
    // Build must fail closed below rather than publishing an unidentifiable release.
  }

  throw new Error('Release identity could not be resolved from RELEASE_ID, GITHUB_SHA, or git HEAD');
}
