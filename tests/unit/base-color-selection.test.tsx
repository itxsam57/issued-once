import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BaseColorSelection } from '@/components/experience/BaseColorSelection';

const qaColors = [
  { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
  { code: 'black', label: 'Black', swatch: '#171713' },
  { code: 'ash', label: 'Ash', swatch: '#aaa69d' },
  { code: 'navy', label: 'Navy', swatch: '#202834' },
  { code: 'forest', label: 'Forest', swatch: '#344238' },
] as const;

describe('BaseColorSelection', () => {
  test('colors the issue with restrained provider-backed choices and no creative hints', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<BaseColorSelection colors={qaColors} onConfirm={onConfirm} />);

    expect(screen.getByText('FIT LOCKED / BASE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Color your issue.' })).toBeInTheDocument();
    for (const color of qaColors) {
      expect(screen.getByRole('radio', { name: color.label })).toBeInTheDocument();
    }
    expect(screen.queryByText(/artwork|design|palette|style|preview|recommended/i)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'LOCK BASE' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Forest' }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith('forest');
  });
});
