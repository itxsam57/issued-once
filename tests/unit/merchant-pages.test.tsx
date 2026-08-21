import { render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import Home from '@/app/page';
import ContactPage from '@/app/contact/page';
import ReturnsPage from '@/app/returns/page';
import StoreInfoPage from '@/app/store-info/page';
import TermsPage from '@/app/terms/page';
import { CommitmentScreen } from '@/components/experience/CommitmentScreen';
import { getPublicCatalogSummary, readPublicMerchant } from '@/brand/publicMerchant';

afterEach(() => {
  for (const key of [
    'MERCHANT_PUBLIC_NAME',
    'MERCHANT_SUPPORT_EMAIL',
    'MERCHANT_SUPPORT_PHONE',
    'MERCHANT_PUBLIC_LOCATION',
    'MERCHANT_LEGAL_ENTITY',
    'ISSUED_ONCE_CATALOG_JSON',
    'DATABASE_URL',
  ]) delete process.env[key];
});

function configureMerchant() {
  process.env.MERCHANT_PUBLIC_NAME = 'ISSUED ONCE';
  process.env.MERCHANT_SUPPORT_EMAIL = 'support@issuedonce.shop';
  process.env.MERCHANT_SUPPORT_PHONE = '+92 300 0000000';
  process.env.MERCHANT_PUBLIC_LOCATION = 'Lahore, Punjab, Pakistan';
  process.env.MERCHANT_LEGAL_ENTITY = 'Example truthful registration text';
}

function configureCatalog() {
  process.env.ISSUED_ONCE_CATALOG_JSON = JSON.stringify({
    currency: 'USD',
    products: {
      tee: {
        slug: 'io-tee',
        variants: [
          { id: 'tee-s-black', size: 'S', colorName: 'Black', amountMinor: 5400, available: true },
          { id: 'tee-m-black', size: 'M', colorName: 'Black', amountMinor: 5600, available: true },
          { id: 'tee-old', size: 'XS', colorName: 'Old', amountMinor: 100, available: false },
        ],
      },
      hat: { slug: 'io-hat', variants: [{ id: 'hat-os-black', size: 'OS', colorName: 'Black', amountMinor: 4200, available: true }] },
      tote: { slug: 'io-tote', variants: [{ id: 'tote-os-bone', size: 'OS', colorName: 'Bone', amountMinor: 3800, available: true }] },
    },
  });
}

test('merchant identity is deployment-backed and never invents a location or legal entity', () => {
  configureMerchant();
  expect(readPublicMerchant(process.env)).toEqual({
    name: 'ISSUED ONCE',
    supportEmail: 'support@issuedonce.shop',
    supportPhone: '+92 300 0000000',
    location: 'Lahore, Punjab, Pakistan',
    legalEntity: 'Example truthful registration text',
    ready: true,
    missing: [],
  });

  const absent = readPublicMerchant({});
  expect(absent.ready).toBe(false);
  expect(absent.location).toBeNull();
  expect(absent.legalEntity).toBeNull();
  expect(absent.missing).toEqual(expect.arrayContaining(['name', 'supportEmail', 'location']));
  expect(JSON.stringify(absent)).not.toMatch(/United States|United Kingdom|Delaware|London|Dubai/i);
});

test('public store pricing is derived from sellable canonical catalog variants', async () => {
  configureCatalog();
  const summary = await getPublicCatalogSummary({ env: process.env });
  expect(summary.currency).toBe('USD');
  expect(summary.products).toEqual([
    expect.objectContaining({ objectType: 'tee', startingAmountMinor: 5400, sellableVariants: 2 }),
    expect.objectContaining({ objectType: 'hat', startingAmountMinor: 4200, sellableVariants: 1 }),
    expect.objectContaining({ objectType: 'tote', startingAmountMinor: 3800, sellableVariants: 1 }),
  ]);
});

test('four public merchant routes explain the real purchase and remedy contract without fabricated domicile', async () => {
  configureMerchant();
  configureCatalog();

  const store = render(await StoreInfoPage());
  expect(screen.getByRole('heading', { name: /What you are actually buying/i })).toBeInTheDocument();
  expect(screen.getByText(/seven answers/i)).toBeInTheDocument();
  expect(screen.getAllByText(/final artwork/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(/\$54\.00/)).toBeInTheDocument();
  store.unmount();

  const contact = render(<ContactPage />);
  expect(screen.getByText('support@issuedonce.shop')).toBeInTheDocument();
  expect(screen.getByText('+92 300 0000000')).toBeInTheDocument();
  expect(screen.getByText('Lahore, Punjab, Pakistan')).toBeInTheDocument();
  contact.unmount();

  const terms = render(<TermsPage />);
  expect(screen.getByText(/rather than previewing the final artwork before payment/i)).toBeInTheDocument();
  expect(screen.getByText(/mandatory consumer rights/i)).toBeInTheDocument();
  terms.unmount();

  render(<ReturnsPage />);
  expect(screen.getByText(/personalized|made-to-order/i)).toBeInTheDocument();
  expect(screen.getByText(/damaged|defective/i)).toBeInTheDocument();
  expect(screen.getByText(/Issue Code/i)).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/Delaware|United Kingdom office|US corporation/i);
});

test('homepage and commitment stage expose restrained merchant-policy links', () => {
  const home = render(<Home />);
  for (const [name, href] of [
    ['STORE INFO', '/store-info'],
    ['CONTACT', '/contact'],
    ['TERMS', '/terms'],
    ['RETURNS', '/returns'],
  ]) {
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  }
  home.unmount();

  render(<CommitmentScreen
    selection={{ object: 'tee', sizeCode: 'M', colorLabel: 'Black' }}
    quote={{ quoteId: 'quote-merchant-test', amountMinor: 5400, currency: 'USD', expiresAt: '2026-08-22T00:00:00.000Z' }}
    onCommit={() => undefined}
  />);
  expect(screen.getByRole('link', { name: 'STORE INFO' })).toHaveAttribute('href', '/store-info');
  expect(screen.getByRole('link', { name: 'TERMS' })).toHaveAttribute('href', '/terms');
  expect(screen.getByRole('link', { name: 'RETURNS' })).toHaveAttribute('href', '/returns');
  expect(screen.getByRole('link', { name: 'CONTACT' })).toHaveAttribute('href', '/contact');
});
