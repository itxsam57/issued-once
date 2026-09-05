import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('home preserves approved copy inside the isolated secret-motion surface', () => {
  const { container } = render(<Home />);

  expect(container.querySelector('[data-io-surface="secret-motion"]')).not.toBeNull();
  expect(container.querySelector('[data-io-motion="pointer-light"]')).not.toBeNull();
  expect(
    screen.getByRole('heading', { name: 'A piece of your mind. Issued for you.' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Nothing has to appear literally to still be there.')).toBeInTheDocument();
  expect(
    screen.getByText('You may recognize where it came from without knowing how it got there.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Seven questions are enough.' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /begin/i }).length).toBeGreaterThan(0);
  expect(screen.queryByText(/shop now/i)).not.toBeInTheDocument();
});
