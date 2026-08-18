import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { SizeConfirmation } from '@/components/experience/SizeConfirmation';

const qaSizes = [
  { code: 'S', label: 'Small', measurements: 'Chest 18 in · Length 28 in' },
  { code: 'M', label: 'Medium', measurements: 'Chest 20 in · Length 29 in' },
  { code: 'L', label: 'Large', measurements: 'Chest 22 in · Length 30 in' },
] as const;

describe('SizeConfirmation', () => {
  test('shows provider facts, asks for one deliberate confirmation, and never invents fit promises', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <SizeConfirmation
        object="tee"
        sizes={qaSizes}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('FORM LOCKED / FIT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose the size it should become.' })).toBeInTheDocument();
    expect(screen.getByText('Chest 20 in · Length 29 in')).toBeInTheDocument();
    expect(screen.queryByText(/perfect fit|guaranteed fit|return|refund/i)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'CONFIRM SIZE' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /Medium/ }));
    expect(screen.getByText('Check this one carefully. This is the size we’ll make.')).toBeInTheDocument();
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith('M');
  });
});
