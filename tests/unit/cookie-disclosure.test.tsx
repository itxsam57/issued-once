import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import CookiesPage from '@/app/cookies/page';
import Home from '@/app/page';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import {
  contactContinuityCookieOptions,
  sessionCookieOptions,
} from '@/server/http/sessionCookie';

test('cookie page explains the strictly necessary order and security cookies without fake consent controls', () => {
  render(<CookiesPage />);

  expect(screen.getByRole('heading', { name: /cookies/i })).toBeInTheDocument();
  expect(screen.getAllByText(/strictly necessary/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/secure session cookie connects this browser/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /accept|reject/i })).not.toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/personalized ads|marketing tracker/i);
});

test('homepage and merchant information footer expose the cookie disclosure', () => {
  const home = render(<Home />);
  expect(screen.getByRole('link', { name: 'COOKIES' })).toHaveAttribute('href', '/cookies');
  home.unmount();

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
