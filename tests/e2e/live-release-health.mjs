const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID?.trim();
if (!expectedReleaseId) throw new Error('EXPECTED_RELEASE_ID is required');

const attempts = Number.parseInt(process.env.LIVE_RELEASE_HEALTH_ATTEMPTS ?? '36', 10);
const delayMs = Number.parseInt(process.env.LIVE_RELEASE_HEALTH_DELAY_MS ?? '10000', 10);
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 120) {
  throw new Error('LIVE_RELEASE_HEALTH_ATTEMPTS is invalid');
}
if (!Number.isInteger(delayMs) || delayMs < 250 || delayMs > 60000) {
  throw new Error('LIVE_RELEASE_HEALTH_DELAY_MS is invalid');
}

const healthPath = '/api/health/release';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastObservedRelease = 'unavailable';
let lastReason = 'not-checked';

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(`${baseUrl}${healthPath}`, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      lastReason = `non-json-http-${response.status}`;
      if (attempt < attempts) {
        console.log(`LIVE_RELEASE_WAIT attempt=${attempt} reason=${lastReason}`);
        await sleep(delayMs);
        continue;
      }
      break;
    }

    const {
      runtimeProvider,
      releaseId,
      version,
      databaseReady,
      queueReady,
      storageReady,
    } = payload ?? {};

    lastObservedRelease = typeof releaseId === 'string' && releaseId.trim() ? releaseId : 'missing';

    if (releaseId !== expectedReleaseId) {
      lastReason = 'release-mismatch';
      if (attempt < attempts) {
        console.log(`LIVE_RELEASE_WAIT attempt=${attempt} reason=${lastReason}`);
        await sleep(delayMs);
        continue;
      }
      break;
    }

    if (runtimeProvider !== 'hostinger') {
      throw new Error(`release health runtimeProvider was ${String(runtimeProvider)}`);
    }
    if (typeof releaseId !== 'string' || !releaseId.trim() || releaseId === 'unknown') {
      throw new Error('release health releaseId is missing');
    }
    if (typeof version !== 'string' || !version.trim()) {
      throw new Error('release health version is missing');
    }
    if (databaseReady !== true || queueReady !== true || storageReady !== true || !response.ok || payload?.ok !== true) {
      lastReason = 'release-not-ready';
      if (attempt < attempts) {
        console.log(`LIVE_RELEASE_WAIT attempt=${attempt} reason=${lastReason}`);
        await sleep(delayMs);
        continue;
      }
      break;
    }

    console.log(`LIVE_RELEASE_HEALTH_PASS provider=${runtimeProvider} release=${releaseId} version=${version}`);
    process.exit(0);
  } catch (error) {
    lastReason = error instanceof Error && error.name === 'TimeoutError' ? 'request-timeout' : 'request-failed';
    if (attempt < attempts) {
      console.log(`LIVE_RELEASE_WAIT attempt=${attempt} reason=${lastReason}`);
      await sleep(delayMs);
      continue;
    }
  }
}

throw new Error(
  `release health did not reach expected release ${expectedReleaseId}; last observed ${lastObservedRelease}; reason ${lastReason}`,
);
