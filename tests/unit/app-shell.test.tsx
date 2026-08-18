import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('home exposes the ISSUED ONCE entry without Shop Now language', () => {
  render(<Home />);
  expect(screen.getByText('ISSUED ONCE')).toBeInTheDocument();
  expect(screen.queryByText(/shop now/i)).not.toBeInTheDocument();
});
