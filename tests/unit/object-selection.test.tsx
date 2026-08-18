import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ObjectSelection } from '@/components/experience/ObjectSelection';


describe('ObjectSelection', () => {
  test('offers only the physical form, keeps artwork unknown, and requires deliberate confirmation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);

    render(<ObjectSelection onSelect={onSelect} />);

    expect(screen.getByText('FORM / UNLOCKED')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose what it exists on.' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'TEE' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'HOODIE' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'HAT' })).toBeInTheDocument();
    expect(screen.queryByText(/artwork|design|preview|sample|recommended/i)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'LOCK FORM' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'HOODIE' }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onSelect).toHaveBeenCalledWith('hoodie');
  });
});
