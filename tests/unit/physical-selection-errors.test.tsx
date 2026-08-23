import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ObjectSelection } from '@/components/experience/ObjectSelection';
import { SizeConfirmation } from '@/components/experience/SizeConfirmation';
import { BaseColorSelection } from '@/components/experience/BaseColorSelection';

describe('physical selection recovery', () => {
  it('keeps the chosen form actionable and shows a visible failure', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn(async () => { throw new Error('That form is unavailable.'); });
    render(<ObjectSelection onSelect={onSelect} />);

    await user.click(screen.getByRole('radio', { name: 'TEE' }));
    await user.click(screen.getByRole('button', { name: 'LOCK FORM' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That form is unavailable.');
    expect(screen.getByRole('radio', { name: 'TEE' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'LOCK FORM' })).toBeEnabled();
  });

  it('keeps the chosen size actionable and shows a visible failure', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => { throw new Error('That size is unavailable.'); });
    render(<SizeConfirmation object="tee" sizes={[{ code: 'M', label: 'Medium' }]} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('radio', { name: 'Medium' }));
    await user.click(screen.getByRole('button', { name: 'CONFIRM SIZE' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That size is unavailable.');
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'CONFIRM SIZE' })).toBeEnabled();
  });

  it('keeps the chosen base color actionable and shows a visible failure', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => { throw new Error('That color is unavailable.'); });
    render(<BaseColorSelection colors={[{ code: 'bone', label: 'Bone', swatch: '#eee' }]} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('radio', { name: 'Bone' }));
    await user.click(screen.getByRole('button', { name: 'LOCK BASE' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That color is unavailable.');
    expect(screen.getByRole('radio', { name: 'Bone' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'LOCK BASE' })).toBeEnabled();
  });
});