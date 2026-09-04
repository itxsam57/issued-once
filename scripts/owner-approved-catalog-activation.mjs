const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID?.trim().toLowerCase();
const internalToken = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
if (!baseUrl?.startsWith('https://')) throw new Error('LIVE_PRODUCTION_URL must be HTTPS');
if (!expectedReleaseId || !/^[0-9a-f]{40}$/.test(expectedReleaseId)) throw new Error('EXPECTED_RELEASE_ID must be a 40-character SHA');
if (!internalToken || internalToken.length < 24) throw new Error('INTERNAL_OPERATIONS_TOKEN is required');

async function json(response) {
  return response.json().catch(() => ({}));
}

const healthResponse = await fetch(`${baseUrl}/api/health/release`, { cache: 'no-store' });
const health = await json(healthResponse);
if (!healthResponse.ok || health?.releaseId !== expectedReleaseId || health?.runtimeProvider !== 'hostinger') {
  throw new Error(`Exact Hostinger release is not live (${healthResponse.status})`);
}
console.log(`CATALOG_GATE_RELEASE_PASS release=${expectedReleaseId}`);

const loginResponse = await fetch(`${baseUrl}/api/ops/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: internalToken }),
});
if (loginResponse.status !== 200) throw new Error(`Owner session login returned ${loginResponse.status}`);
const setCookie = loginResponse.headers.get('set-cookie') ?? '';
const ownerCookie = setCookie.split(';', 1)[0];
if (!/^io_ops=/.test(ownerCookie)) throw new Error('Owner session cookie was not issued');
console.log('CATALOG_GATE_OWNER_AUTH_PASS');

async function getWebsite() {
  const response = await fetch(`${baseUrl}/ops/api/website`, {
    headers: { cookie: ownerCookie },
    cache: 'no-store',
  });
  const payload = await json(response);
  if (response.status !== 200) throw new Error(`Owner website state returned ${response.status}`);
  return payload;
}

function assertCatalogShape(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Catalog payload is missing');
  if (!['USD', 'PKR'].includes(payload.currency)) throw new Error('Catalog currency is unsupported');
  const expected = { tee: 'io-tee', hat: 'io-hat', tote: 'io-tote' };
  for (const [key, slug] of Object.entries(expected)) {
    const product = payload.products?.[key];
    if (!product || product.slug !== slug || !Array.isArray(product.variants) || product.variants.length < 1) {
      throw new Error(`Catalog ${key} definition is not the deployed canonical form`);
    }
    for (const variant of product.variants) {
      if (!variant?.id || !variant?.size || !variant?.colorName || !Number.isInteger(variant?.amountMinor) || variant.amountMinor <= 0 || typeof variant.available !== 'boolean') {
        throw new Error(`Catalog ${key} contains an invalid variant`);
      }
    }
  }
}

let state = await getWebsite();
assertCatalogShape(state?.catalog?.payload);
const initialSource = state?.catalog?.source;
const initialVersion = Number(state?.catalog?.version ?? -1);
const catalogPayload = state.catalog.payload;
const productCount = Object.keys(catalogPayload.products).length;
const variantCount = Object.values(catalogPayload.products).reduce((sum, product) => sum + product.variants.length, 0);
console.log(`CATALOG_GATE_BEFORE source=${initialSource} version=${initialVersion} currency=${catalogPayload.currency} products=${productCount} variants=${variantCount}`);

if (initialSource === 'BOOT') {
  const publishResponse = await fetch(`${baseUrl}/ops/api/website/catalog`, {
    method: 'POST',
    headers: { cookie: ownerCookie, 'content-type': 'application/json' },
    body: JSON.stringify(catalogPayload),
  });
  const publishPayload = await json(publishResponse);
  if (publishResponse.status !== 200 || publishPayload?.ok !== true || !Number.isInteger(publishPayload?.version) || publishPayload.version < 1) {
    throw new Error(`Catalog publication returned ${publishResponse.status}`);
  }
  console.log(`CATALOG_GATE_PUBLICATION_ACCEPTED version=${publishPayload.version}`);
} else if (initialSource !== 'ACTIVE') {
  throw new Error(`Unexpected catalog source: ${String(initialSource)}`);
}

state = await getWebsite();
if (state?.catalog?.source !== 'ACTIVE' || !Number.isInteger(state?.catalog?.version) || state.catalog.version < 1) {
  throw new Error('Catalog did not become ACTIVE');
}
if (JSON.stringify(state.catalog.payload) !== JSON.stringify(catalogPayload)) {
  throw new Error('ACTIVE catalog payload differs from the approved deployed catalog');
}
console.log(`CATALOG_ACTIVATION_PASS version=${state.catalog.version} currency=${state.catalog.payload.currency}`);

const readinessResponse = await fetch(`${baseUrl}/ops/api/readiness`, {
  headers: { cookie: ownerCookie },
  cache: 'no-store',
});
const readiness = await json(readinessResponse);
if (readinessResponse.status !== 200 || !Array.isArray(readiness?.checks)) {
  throw new Error(`Owner readiness returned ${readinessResponse.status}`);
}
for (const check of readiness.checks) {
  if (['catalog', 'catalog-authority', 'safepay', 'printful', 'merchant', 'resend', 'storage'].includes(check.key)) {
    console.log(`READINESS ${check.key}=${check.state} detail=${String(check.detail).replace(/\s+/g, ' ')}`);
  }
}
const authority = readiness.checks.find((check) => check.key === 'catalog-authority');
if (authority?.state !== 'ready') throw new Error('Catalog authority readiness is not ready after publication');
