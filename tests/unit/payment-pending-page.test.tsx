import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

vi.mock('@/components/experience/IssueStatusView', () => ({
  IssueStatusView: () => <section data-testid="issue-status-view">ISSUE STATUS</section>,
}));

import PaymentPendingPage from '@/app/payment/pending/page';

test('pending payment keeps the customer on live Issue polling/recovery inside the approved public shell', () => {
  render(<PaymentPendingPage />);

  expect(screen.getByTestId('issue-status-view')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ISSUED ONCE' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'INFO' })).toHaveAttribute('href', '/store-info');
  expect(screen.getByRole('link', { name: 'STATUS' })).toHaveAttribute('href', '/issue');
});
