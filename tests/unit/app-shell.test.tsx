import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('home opens with the approved issued-for-you editorial sequence and no sales pressure', () => {
  render(<Home />);

  expect(screen.getByRole('link', { name: 'ISSUED ONCE' })).toHaveAttribute('href', '/');
  expect(
    screen.getByRole('heading', { name: 'A piece of your mind. Issued for you.' }),
  ).toBeInTheDocument();
  expect(screen.getByText('questions are enough.')).toBeInTheDocument();
  expect(screen.getByText('design.')).toBeInTheDocument();
  expect(screen.getByText('exists once.')).toBeInTheDocument();
  expect(screen.getByText('HIDDEN')).toBeInTheDocument();
  expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'BEGIN.' })).toHaveAttribute('href', '/begin');

  expect(document.querySelector('[data-issue-ledger]')).toBeNull();
  expect(screen.queryByText(/shop now/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/countdown|only \d+ left|hurry|ending soon/i)).not.toBeInTheDocument();
});
