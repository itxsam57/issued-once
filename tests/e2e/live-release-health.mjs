const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const healthPath = '/api/health/release';
const response = await fetch(`${baseUrl}${healthPath}`, {
  headers: { accept: 'application/json' },
  redirect: 'error',
});

let payload;
try {
  payload = await response.json();
} catch {
  throw new Error(`release health returned non-JSON HTTP ${response.status}`);
}

const {
  runtimeProvider,
  releaseId,
  version,
  databaseReady,
  queueReady,
  storageReady,
} = payload ?? {};

if (runtimeProvider !== 'hostinger') {
  throw new Error(`release health runtimeProvider was ${String(runtimeProvider)}`);
}
if (typeof releaseId !== 'string' || !releaseId.trim() || releaseId === 'unknown') {
  throw new Error('release health releaseId is missing');
}
if (typeof version !== 'string' || !version.trim()) {
  throw new Error('release health version is missing');
}
if (databaseReady !== true) throw new Error('release health databaseReady is false');
if (queueReady !== true) throw new Error('release health queueReady is false');
if (storageReady !== true) throw new Error('release health storageReady is false');
if (!response.ok || payload?.ok !== true) {
  throw new Error(`release health failed with HTTP ${response.status}`);
}

console.log(`LIVE_RELEASE_HEALTH_PASS provider=${runtimeProvider} release=${releaseId} version=${version}`);
