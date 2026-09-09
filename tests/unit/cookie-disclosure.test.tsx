import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import CookiesPage from '@/app/cookies/page';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import {
  contactContinuityCookieOptions,
  sessionCookieOptions,
} from '@/server/http/sessionCookie';

test('cookie page explains the strictly necessary order and security cookies without fake consent controls', () => {
  render(<CookiesPage />);

  expect(screen.getByRole('heading', { name: /cookies/i })).toBeInTheDocument();
  expect(screen.getByText(/strictly necessary/i)).toBeInTheDocument();
  expect(screen.getByText(/order|progress|session/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /accept|reject/i })).not.toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/advertising|personalized ads|marketing tracker/i);
});

test('merchant information footer exposes the cookie disclosure', () => {
  render(
    <MerchantPageShell kicker="TEST" title="TEST" intro="TEST">
      <p>Body</p>
    </MerchantPageShell>,
  );
  expect(screen.getByRole('link', { name: 'COOKIES' })).toHaveAttribute('href', '/cookies');
});

test('customer continuity cookies remain hardened and first-party only', () => {
  for (const options of [sessionCookieOptions, contactContinuityCookieOptions]) {
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  }
});
