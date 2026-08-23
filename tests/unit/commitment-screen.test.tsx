import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { CommitmentScreen } from '@/components/experience/CommitmentScreen';

const quote = {
  quoteId: 'qa-quote-001',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: '2026-08-18T06:00:00.000Z',
} as const;

describe('CommitmentScreen', () => {
  test('shows the locked physical facts and real price without fear, scarcity, or creative preview language', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn().mockResolvedValue(undefined);

    render(
      <CommitmentScreen
        selection={{ object: 'hoodie', sizeCode: 'M', colorLabel: 'Bone' }}
        quote={quote}
        onCommit={onCommit}
      />,
    );

    expect(screen.getByText('FORM COMPLETE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'From here, it becomes ours to interpret.' })).toBeInTheDocument();
    expect(screen.getByText('HOODIE / M / BONE')).toBeInTheDocument();
    expect(screen.getByText('$54.00')).toBeInTheDocument();
    expect(screen.getByText('Everything else stays unknown until it arrives.')).toBeInTheDocument();
    expect(screen.queryByText(/final sale|countdown|left in stock|people are viewing|design preview|artwork preview|sample artwork|palette preview|style preview|guaranteed refund|instant refund/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'RETURNS' })).toHaveAttribute('href', '/returns');

    await user.click(screen.getByRole('button', { name: 'ISSUE MINE' }));
    expect(onCommit).toHaveBeenCalledWith('qa-quote-001');
  });

  test('keeps the locked commitment intact and offers retry when checkout cannot open', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn().mockRejectedValue(new Error('Quote changed'));

    render(
      <CommitmentScreen
        selection={{ object: 'hoodie', sizeCode: 'M', colorLabel: 'Bone' }}
        quote={quote}
        onCommit={onCommit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ISSUE MINE' }));

    expect(screen.getByText('HOODIE / M / BONE')).toBeInTheDocument();
    expect(screen.getByText('$54.00')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('CHECKOUT NOT OPENED / TRY AGAIN');
    expect(screen.getByRole('button', { name: 'ISSUE MINE' })).toBeEnabled();
  });
});
