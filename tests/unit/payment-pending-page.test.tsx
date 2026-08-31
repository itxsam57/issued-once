import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

vi.mock('@/components/experience/IssueStatusView', () => ({
  IssueStatusView: () => <section data-testid="issue-status-view">ISSUE STATUS</section>,
}));

import PaymentPendingPage from '@/app/payment/pending/page';

test('pending payment keeps the customer on the live Issue polling and recovery surface', () => {
  render(<PaymentPendingPage />);

  expect(screen.getByTestId('issue-status-view')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'ISSUED ONCE' })).not.toBeInTheDocument();
});
