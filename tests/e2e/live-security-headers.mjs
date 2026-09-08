const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const REQUIRED_SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

const response = await fetch(`${baseUrl}/`, {
  headers: {
    accept: 'text/html,application/xhtml+xml',
    'user-agent': 'issued-once-live-security-header-audit/1.0',
  },
  redirect: 'error',
  signal: AbortSignal.timeout(10_000),
});

const failures = [];
if (response.status !== 200) {
  failures.push(`bare / returned HTTP ${response.status}; expected 200`);
}

for (const [name, expected] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
  const actual = response.headers.get(name);
  if (actual !== expected) {
    failures.push(`bare / ${name} mismatch`);
  }
}

if (response.headers.has('x-powered-by')) {
  failures.push('bare / exposes x-powered-by');
}

const cacheControl = response.headers.get('cache-control') ?? '';
if (!cacheControl.includes('no-store')) {
  failures.push('bare / cache-control is missing no-store');
}
if (/s-maxage\s*=/i.test(cacheControl)) {
  failures.push('bare / cache-control contains s-maxage');
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.log(`LIVE_SECURITY_HEADER_FINDING ${failure}`);
  }
  throw new Error(`Strict Hostinger header audit found ${failures.length} finding(s)`);
}

console.log('LIVE_SECURITY_HEADER_PASS bare-home exact-baseline no-powered-by no-store no-s-maxage');
