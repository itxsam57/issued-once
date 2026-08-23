import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('home opens with the issued-for-you idea and lets curiosity carry the page', () => {
  render(<Home />);

  expect(screen.getByText('ISSUED ONCE')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'A piece of your mind. Issued for you.' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Nothing has to appear literally to still be there.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('You may recognize where it came from without knowing how it got there.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', {
      name: "Some of this might get personal. It doesn't need to become public.",
    }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /begin/i }).length).toBeGreaterThan(0);

  expect(screen.queryByText('There is something here that does not exist yet.')).not.toBeInTheDocument();
  expect(screen.queryByText(/shop now/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/no account|no payment/i)).not.toBeInTheDocument();
});
