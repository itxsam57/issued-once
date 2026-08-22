import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { SizeConfirmation } from '@/components/experience/SizeConfirmation';

const qaSizes = [
  { code: 'XS', label: 'Extra small', measurements: 'Chest 17 in · Length 27 in' },
  { code: 'S', label: 'Small', measurements: 'Chest 18 in · Length 28 in' },
  { code: 'M', label: 'Medium', measurements: 'Chest 20 in · Length 29 in' },
  { code: 'L', label: 'Large', measurements: 'Chest 22 in · Length 30 in' },
  { code: 'XL', label: 'Extra large', measurements: 'Chest 24 in · Length 31 in' },
  { code: '2XL', label: '2X large', measurements: 'Chest 26 in · Length 32 in' },
] as const;

describe('SizeConfirmation', () => {
  test('keeps six provider sizes quiet until one is touched', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<SizeConfirmation object="tee" sizes={qaSizes} onConfirm={onConfirm} />);

    expect(screen.getByText('FORM LOCKED / FIT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pick your size.' })).toBeInTheDocument();
    for (const size of qaSizes) {
      expect(
        screen.getByRole('radio', { name: new RegExp(`^${size.label} —`, 'i') }),
      ).toBeInTheDocument();
    }
    expect(screen.queryByText('Chest 20 in · Length 29 in')).not.toBeInTheDocument();
    expect(screen.queryByText(/perfect fit|guaranteed fit|return|refund/i)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'CONFIRM SIZE' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /^Medium —/ }));
    expect(screen.getByText('Chest 20 in · Length 29 in')).toBeInTheDocument();
    expect(screen.getByText('Check this one carefully. This is the size we’ll make.')).toBeInTheDocument();
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith('M');
  });

  test('renders a provider size cleanly when no measurement facts are supplied', () => {
    render(
      <SizeConfirmation object="tote" sizes={[{ code: 'OS', label: 'One size' }]} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole('radio', { name: 'One size' })).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('undefined');
  });
});
