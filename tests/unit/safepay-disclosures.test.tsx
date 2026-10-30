import { render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import PrivacyPage from '@/app/privacy/page';
import ShippingPage from '@/app/shipping/page';
import StoreInfoPage from '@/app/store-info/page';
import Home from '@/app/page';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import { CommitmentScreen } from '@/components/experience/CommitmentScreen';

afterEach(() => {
  delete process.env.ISSUED_ONCE_CATALOG_JSON;
  delete process.env.DATABASE_URL;
  delete process.env.MERCHANT_SUPPORT_EMAIL;
});

test('a public privacy notice explains customer data, disclosure and a contact route', () => {
  process.env.MERCHANT_SUPPORT_EMAIL = 'support@issuedonce.shop';
  render(<PrivacyPage />);
  expect(screen.getByRole('heading', { name: /Privacy.*Issue/i })).toBeInTheDocument();
  for (const item of [/answers/i, /shipping/i, /payment/i, /retention/i, /request/i]) {
    expect(document.body.textContent).toMatch(item);
  }
  expect(screen.getByRole('link', { name: 'contact page' })).toHaveAttribute('href', '/contact');
  expect(document.body.textContent).not.toMatch(/we store your payment card|guaranteed deletion in \d+ days/i);
});

test('delivery policy explains timing, charges, destinations, customs and failed fulfillment', () => {
  render(<ShippingPage />);
  expect(screen.getByRole('heading', { name: /Delivery.*Issue/i })).toBeInTheDocument();
  expect(document.body.textContent).toMatch(/estimate/i);
  expect(document.body.textContent).toMatch(/destination/i);
  expect(document.body.textContent).toMatch(/customs/i);
  expect(document.body.textContent).toMatch(/charge/i);
  expect(document.body.textContent).toMatch(/cannot be fulfilled/i);
  expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact');
});

test('policy links are discoverable from home, merchant pages, and pre-checkout', () => {
  for (const [page, label] of [
    [<Home key="home" />, 'Footer'],
    [<MerchantPageShell kicker="A" title="B" intro="C" key="merchant">Content</MerchantPageShell>, 'Merchant information'],
    [<CommitmentScreen key="commit" selection={{ object: 'tee', sizeCode: 'M', colorLabel: 'Ash' }} quote={{ quoteId: 'q', amountMinor: 3200, currency: 'USD', expiresAt: '2026-11-01T00:00:00.000Z' }} onCommit={() => undefined} />, 'Purchase information'],
  ] as const) {
    const view = render(page);
    const nav = screen.getByRole('navigation', { name: label });
    expect(nav.querySelector('a[href="/privacy"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/shipping"]')).not.toBeNull();
    view.unmount();
  }
});

test('store info displays prices from active sellable catalog rather than a hard-coded quote', async () => {
  process.env.ISSUED_ONCE_CATALOG_JSON = JSON.stringify({
    currency: 'USD',
    products: {
      tee: { slug: 'io-tee', variants: [{ id: 't-1', size: 'S', colorName: 'Black', amountMinor: 6100, available: true }] },
      hat: { slug: 'io-hat', variants: [{ id: 'h-1', size: 'OS', colorName: 'Black', amountMinor: 4300, available: true }] },
      tote: { slug: 'io-tote', variants: [{ id: 'b-1', size: 'OS', colorName: 'Natural', amountMinor: 3500, available: true }] },
    },
  });
  render(await StoreInfoPage());
  expect(screen.getByText('$61.00')).toBeInTheDocument();
  expect(screen.getByText('$43.00')).toBeInTheDocument();
  expect(screen.getByText('$35.00')).toBeInTheDocument();
  expect(screen.getByText(/Final price.*checkout/i)).toBeInTheDocument();
});