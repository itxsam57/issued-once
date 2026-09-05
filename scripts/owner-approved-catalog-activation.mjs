import { isDeepStrictEqual } from 'node:util';
import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID?.trim().toLowerCase();
const internalToken = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
if (!baseUrl?.startsWith('https://')) throw new Error('LIVE_PRODUCTION_URL must be HTTPS');
if (!expectedReleaseId || !/^[0-9a-f]{40}$/.test(expectedReleaseId)) throw new Error('EXPECTED_RELEASE_ID must be a 40-character SHA');
if (!internalToken || internalToken.length < 24) throw new Error('INTERNAL_OPERATIONS_TOKEN is required');

const teeSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const teeColors = [
  { code: 'bone', name: 'Bone', swatch: '#f0f1ea' },
  { code: 'black', name: 'Black', swatch: '#0c0c0c' },
  { code: 'ash', name: 'Ash', swatch: '#cececc' },
  { code: 'navy', name: 'Navy', swatch: '#212642' },
  { code: 'forest', name: 'Forest', swatch: '#223e25' },
];
const approvedCatalog = {
  currency: 'USD',
  products: {
    tee: {
      slug: 'io-tee',
      variants: teeSizes.flatMap((size) => teeColors.map((color) => ({
        id: `io-tee-${size.toLowerCase()}-${color.code}`,
        size,
        colorName: color.name,
        colorSwatch: color.swatch,
        amountMinor: 3200,
        available: true,
      }))),
    },
    hat: {
      slug: 'io-hat',
      variants: [
        { id: 'io-hat-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#d6bdad', amountMinor: 3400, available: true },
        { id: 'io-hat-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#181717', amountMinor: 3400, available: true },
      ],
    },
    tote: {
      slug: 'io-tote',
      variants: [
        { id: 'io-tote-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#edcea5', amountMinor: 3600, available: true },
        { id: 'io-tote-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#101010', amountMinor: 3600, available: true },
      ],
    },
  },
};

async function json(response) {
  return response.json().catch(() => ({}));
}

function assertApprovedCatalog(payload) {
  if (!isDeepStrictEqual(payload, approvedCatalog)) {
    throw new Error('Catalog payload differs structurally from the exact approved 34-variant boot catalog');
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
    const setCookie = loginResponse.headers()['set-cookie'] ?? '';
    const ownerCookie = setCookie.split(';', 1)[0];
    if (!/^io_ops=/.test(ownerCookie)) throw new Error('Owner session cookie was not issued');
    console.log('CATALOG_GATE_OWNER_AUTH_PASS');

    async function readReadiness(prefix) {
      const response = await request.get(`${baseUrl}/ops/api/readiness`, {
        headers: { cookie: ownerCookie, 'cache-control': 'no-store' },
      });
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
      const response = await request.get(`${baseUrl}/ops/api/website`, {
        headers: { cookie: ownerCookie, 'cache-control': 'no-store' },
      });
      const payload = await json(response);
      if (response.status() !== 200) throw new Error(`Owner website state returned ${response.status()}`);
      return payload;
    }

    let state = await getWebsite();
    const initialSource = state?.catalog?.source;
    const initialVersion = Number(state?.catalog?.version ?? -1);
    const catalogPayload = state?.catalog?.payload;
    assertApprovedCatalog(catalogPayload);
    console.log(`CATALOG_GATE_BEFORE source=${initialSource} version=${initialVersion} currency=${catalogPayload.currency} products=3 variants=34`);

    if (initialSource === 'BOOT') {
      const publishResponse = await request.post(`${baseUrl}/ops/api/website/catalog`, {
        headers: { cookie: ownerCookie, 'content-type': 'application/json' },
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
    assertApprovedCatalog(state.catalog.payload);
    console.log(`CATALOG_ACTIVATION_PASS version=${state.catalog.version} currency=${state.catalog.payload.currency} products=3 variants=34`);

    const readiness = await readReadiness('READINESS');
    const authority = readiness.checks.find((check) => check.key === 'catalog-authority');
    if (authority?.state !== 'ready') throw new Error('Catalog authority readiness is not ready after publication');
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
