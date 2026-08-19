import { render, screen } from '@testing-library/react';
import { OwnerOsShell } from '@/components/ops/OwnerOsShell';

test('renders the complete Owner OS navigation without private customer data', () => {
  render(<OwnerOsShell active="Home" onNavigate={() => undefined}><div>SAFE CONTENT</div></OwnerOsShell>);

  for (const label of ['Home', 'Issues', 'Designer', 'Manufacturing', 'Sales', 'Customers', 'Support', 'Website', 'System', 'Audit']) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  }
  expect(screen.getByText('SAFE CONTENT')).toBeInTheDocument();
  expect(screen.queryByText(/private@example.com/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/raw answers/i)).not.toBeInTheDocument();
});
