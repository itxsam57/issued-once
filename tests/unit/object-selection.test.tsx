import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ObjectSelection } from '@/components/experience/ObjectSelection';

describe('ObjectSelection', () => {
  test('offers the current issue shapes in a human voice while keeping winter forms out of season', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);

    render(<ObjectSelection onSelect={onSelect} />);

    expect(screen.getByText('FORM / CURRENT ISSUE')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Pick the shape your issue lives on.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'TEE' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'CAP' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'TOTE' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'HOODIE' })).not.toBeInTheDocument();
    expect(screen.queryByText(/artwork|design|preview|sample|recommended/i)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'LOCK FORM' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'TEE' }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onSelect).toHaveBeenCalledWith('tee');
  });
});
