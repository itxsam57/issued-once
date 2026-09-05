import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID?.trim().toLowerCase();
const internalToken = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
if (!baseUrl?.startsWith('https://')) throw new Error('LIVE_PRODUCTION_URL must be HTTPS');
if (!expectedReleaseId || !/^[0-9a-f]{40}$/.test(expectedReleaseId)) throw new Error('EXPECTED_RELEASE_ID must be a 40-character SHA');
if (!internalToken || internalToken.length < 24) throw new Error('INTERNAL_OPERATIONS_TOKEN is required');

async function json(response) {
  return response.json().catch(() => ({}));
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

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    const begin = await page.goto(`${baseUrl}/begin`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!begin?.ok()) throw new Error(`/begin returned ${begin?.status() ?? 'NO_RESPONSE'}`);

    const request = context.request;
    const healthResponse = await request.get(`${baseUrl}/api/health/release`, { headers: { 'cache-control': 'no-store' } });
    const health = await json(healthResponse);
    if (!healthResponse.ok() || health?.releaseId !== expectedReleaseId || health?.runtimeProvider !== 'hostinger') {
      throw new Error(`Exact Hostinger release is not live (${healthResponse.status()})`);
    }
    console.log(`CATALOG_GATE_RELEASE_PASS release=${expectedReleaseId}`);

    const loginResponse = await request.post(`${baseUrl}/api/ops/session`, {
      headers: { 'content-type': 'application/json' },
      data: { token: internalToken },
    });
    if (loginResponse.status() !== 200) throw new Error(`Owner session login returned ${loginResponse.status()}`);
    const ownerCookies = await context.cookies(baseUrl);
    if (!ownerCookies.some((cookie) => cookie.name === 'io_ops' && cookie.value)) throw new Error('Owner session cookie was not issued');
    console.log('CATALOG_GATE_OWNER_AUTH_PASS');

    async function readReadiness(prefix) {
      const response = await request.get(`${baseUrl}/ops/api/readiness`, { headers: { 'cache-control': 'no-store' } });
      const payload = await json(response);
      if (response.status() !== 200 || !Array.isArray(payload?.checks)) {
        throw new Error(`Owner readiness returned ${response.status()}`);
      }
      for (const check of payload.checks) {
        if (['catalog', 'catalog-authority', 'safepay', 'printful', 'merchant', 'resend', 'storage', 'database', 'privacy'].includes(check.key)) {
          console.log(`${prefix} ${check.key}=${check.state} detail=${String(check.detail).replace(/\s+/g, ' ')}`);
        }
      }
      return payload;
    }

    await readReadiness('READINESS_BEFORE');

    async function getWebsite() {
      const response = await request.get(`${baseUrl}/ops/api/website`, { headers: { 'cache-control': 'no-store' } });
      const payload = await json(response);
      if (response.status() !== 200) throw new Error(`Owner website state returned ${response.status()}`);
      return payload;
    }

    let state = await getWebsite();
    assertCatalogShape(state?.catalog?.payload);
    const initialSource = state?.catalog?.source;
    const initialVersion = Number(state?.catalog?.version ?? -1);
    const catalogPayload = state.catalog.payload;
    const productCount = Object.keys(catalogPayload.products).length;
    const variantCount = Object.values(catalogPayload.products).reduce((sum, product) => sum + product.variants.length, 0);
    if (productCount !== 3 || variantCount !== 34) throw new Error(`Expected exact approved 3-product/34-variant catalog, got products=${productCount} variants=${variantCount}`);
    console.log(`CATALOG_GATE_BEFORE source=${initialSource} version=${initialVersion} currency=${catalogPayload.currency} products=${productCount} variants=${variantCount}`);

    if (initialSource === 'BOOT') {
      const publishResponse = await request.post(`${baseUrl}/ops/api/website/catalog`, {
        headers: { 'content-type': 'application/json' },
        data: catalogPayload,
      });
      const publishPayload = await json(publishResponse);
      if (publishResponse.status() !== 200 || publishPayload?.ok !== true || !Number.isInteger(publishPayload?.version) || publishPayload.version < 1) {
        throw new Error(`Catalog publication returned ${publishResponse.status()}: ${String(publishPayload?.error ?? 'unknown')}`);
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

    const readiness = await readReadiness('READINESS');
    const authority = readiness.checks.find((check) => check.key === 'catalog-authority');
    if (authority?.state !== 'ready') throw new Error('Catalog authority readiness is not ready after publication');
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
