const baseUrl = process.env.PREVIEW_URL?.trim();
if (!baseUrl) throw new Error('PREVIEW_URL is required');

const { hostname } = new URL(baseUrl);
const isHostinger = hostname === 'issuedonce.shop' || hostname.endsWith('.hostingersite.com');

if (isHostinger) {
  await import('./live-hostinger-preview.mjs');
} else {
  await import('./live-owner-preview.mjs');
}
