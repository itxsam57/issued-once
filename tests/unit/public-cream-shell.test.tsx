import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MerchantPageShell } from '@/app/MerchantPageShell';
import IssuePage from '@/app/issue/page';
import PaymentPendingPage from '@/app/payment/pending/page';

vi.mock('@/components/experience/IssueStatusView', () => ({ IssueStatusView: () => <div>STATUS VIEW</div> }));

describe('final public cream shell', () => {
  test('merchant pages use the shared fixed public utility header', () => {
    render(<MerchantPageShell kicker="K" title="T" intro="I"><p>BODY</p></MerchantPageShell>);
    const header = document.querySelector('[data-public-header]');
    expect(header).not.toBeNull();
    expect(header).toHaveTextContent('ISSUED ONCE');
    expect(header).toHaveTextContent('INFO');
    expect(header).toHaveTextContent('STATUS');
  });

  test.each([['issue', IssuePage], ['pending', PaymentPendingPage]])('%s status route uses the same public header', (_name, Page) => {
    render(<Page />);
    expect(document.querySelector('[data-public-header]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'ISSUED ONCE' })).toHaveAttribute('href', '/');
  });
  test('downstream public styles use the approved shared cream tokens', () => {
    const files = [
      'src/components/experience/contact-verification.module.css',
      'src/components/experience/shipping-address.module.css',
      'src/components/experience/issue-status.module.css',
      'src/components/experience/issue-support-form.module.css',
      'src/app/merchant.module.css',
    ];
    for (const file of files) {
      const css = readFileSync(join(process.cwd(), file), 'utf8');
      expect(css, file).toContain('var(--serif)');
      expect(css, file).not.toMatch(/Bodoni|Didot|Iowan Old Style|#6d1d1d/i);
    }
  });
});
