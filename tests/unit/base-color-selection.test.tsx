import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BaseColorSelection } from '@/components/experience/BaseColorSelection';

const qaColors = [
  { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
  { code: 'black', label: 'Black', swatch: '#171713' },
  { code: 'ash', label: 'Ash', swatch: '#aaa69d' },
] as const;

describe('BaseColorSelection', () => {
  test('lets the buyer choose only an available physical base color without exposing creative direction', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<BaseColorSelection colors={qaColors} onConfirm={onConfirm} />);

    expect(screen.getByText('FIT LOCKED / BASE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose the color it begins as.' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Bone' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Black' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ash' })).toBeInTheDocument();
    expect(screen.queryByText(/artwork|design|palette|style|preview|recommended/i)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'LOCK BASE' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Bone' }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith('bone');
  });
});
