import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ObjectSelection } from '@/components/experience/ObjectSelection';

const expectedFormAssets = {
  TEE: '/assets/issued-once/asset-form-tee.jpg',
  CAP: '/assets/issued-once/asset-form-cap.jpg',
  TOTE: '/assets/issued-once/asset-form-tote.jpg',
} as const;

describe('approved object inspection selector', () => {
  test('starts with three form-study cards and never exposes hidden artwork language', () => {
    render(<ObjectSelection onSelect={vi.fn()} />);

    for (const [label, asset] of Object.entries(expectedFormAssets)) {
      const radio = screen.getByRole('radio', { name: label });
      expect(radio).toBeInTheDocument();
      const card = radio.closest('[data-object-card]');
      expect(card).not.toBeNull();
      expect(card).toHaveAttribute('data-mode', 'FORM');
      expect(card?.querySelector('img')).toHaveAttribute('src', asset);
    }

    expect(screen.queryByText(/generated artwork|design preview|your design/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-object-card]')).toHaveLength(3);
  });

  test('repeated activation cycles inspection modes without committing the object', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(<ObjectSelection onSelect={onSelect} />);

    const tee = screen.getByRole('radio', { name: 'TEE' });
    const card = () => tee.closest('[data-object-card]');
    const confirm = screen.getByRole('button', { name: 'LOCK FORM' });

    await user.click(tee);
    expect(card()).toHaveAttribute('data-selected', 'true');
    expect(card()).toHaveAttribute('data-mode', 'FORM');
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(tee);
    expect(card()).toHaveAttribute('data-mode', 'MATERIAL');
    expect(card()?.querySelector('img')).toHaveAttribute('src', '/assets/issued-once/asset-macro-tee.jpg');
    expect(screen.getByText('50%')).toBeInTheDocument();

    await user.click(tee);
    expect(card()).toHaveAttribute('data-mode', 'TECHNICAL');
    expect(card()?.querySelector('img')).toHaveAttribute('src', '/assets/issued-once/asset-tech-tee.jpg');

    await user.click(tee);
    expect(card()).toHaveAttribute('data-mode', 'DISPLAY');
    expect(card()?.querySelector('img')).toHaveAttribute('src', '/assets/issued-once/asset-museum-tee.jpg');

    await user.click(tee);
    expect(card()).toHaveAttribute('data-mode', 'FORM');
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(confirm);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('tee');
  });
  test('pins the approved card geometry and pointer inspection hooks', () => {
    render(<ObjectSelection onSelect={vi.fn()} />);
    const tee = screen.getByRole('radio', { name: 'TEE' });
    const card = tee.closest('[data-object-card]') as HTMLElement;
    fireEvent.pointerMove(card, { clientX: 90, clientY: 70 });
    expect(card.style.getPropertyValue('--inspect-x')).not.toBe('');

    const css = readFileSync(join(process.cwd(), 'src/app/reference-ui.css'), 'utf8');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toContain('gap: 16px;');
    expect(css).toContain('height: 380px;');
    expect(css).toMatch(/max-width:\s*720px[\s\S]*height:\s*240px/);
  });

  test('locks object choices while the selected form is being saved', async () => {
    const user = userEvent.setup();
    let release: (() => void) | null = null;
    const onSelect = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    render(<ObjectSelection onSelect={onSelect} />);
    const tee = screen.getByRole('radio', { name: 'TEE' });
    const cap = screen.getByRole('radio', { name: 'CAP' });
    await user.click(tee);
    await user.click(screen.getByRole('button', { name: 'LOCK FORM' }));
    expect(tee).toBeDisabled();
    expect(cap).toBeDisabled();
  });

});
