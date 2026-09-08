import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import Home from '@/app/page';
import { MysteryExperience } from '@/components/experience/MysteryExperience';

describe('owner-approved final production UI contract', () => {
  test('homepage renders the exact cream editorial sequence without a ritual ledger', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: 'A piece of your mind. Issued for you.' })).toBeInTheDocument();
    expect(screen.getByText('questions are enough.')).toBeInTheDocument();
    expect(screen.getByText('design.')).toBeInTheDocument();
    expect(screen.getByText('exists once.')).toBeInTheDocument();
    expect(screen.getByText('HIDDEN')).toBeInTheDocument();
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BEGIN.' })).toBeInTheDocument();
    expect(document.querySelector('[data-issue-ledger]')).toBeNull();

    const text = document.body.textContent ?? '';
    expect(text.indexOf('questions are enough.')).toBeLessThan(text.indexOf('design.'));
    expect(text.indexOf('design.')).toBeLessThan(text.indexOf('exists once.'));
    expect(text.indexOf('exists once.')).toBeLessThan(text.indexOf('HIDDEN'));
  });

  test('hero material study receives pointer coordinates without becoming a product preview', () => {
    render(<Home />);
    const study = screen.getByTestId('home-material-study');
    fireEvent.pointerMove(study, { clientX: 120, clientY: 80 });
    expect(study.style.getPropertyValue('--pointer-x')).not.toBe('');
    expect(study).toHaveAttribute('aria-hidden', 'true');
    expect(study.querySelector('img')).toBeNull();
  });

  test('global theme pins the approved cream palette', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toContain('--bg: #F3EEE6;');
    expect(css).toContain('--ink: #11100E;');
    expect(css).toContain('--signal: #9B6B47;');
    expect(css).toMatch(/background:\s*var\(--bg\)/);
  });

  test('started ritual shows truthful not-yet Issue state before payment allocation', () => {
    render(
      <MysteryExperience
        onAnswer={vi.fn()}
        onObjectSelected={vi.fn()}
      />,
    );

    const ledger = document.querySelector('[data-issue-ledger]');
    expect(ledger).not.toBeNull();
    expect(ledger).toHaveTextContent('ISSUE');
    expect(ledger).toHaveTextContent('NOT YET');
    expect(ledger?.textContent).not.toMatch(/IO-[23456789A-Z]{4}-[23456789A-Z]{4}/);
    expect(ledger).toHaveTextContent('ANSWERS');
    expect(ledger).toHaveTextContent('0 / 7');
  });
  test('ledger answer count advances only after the real answer handler succeeds', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    render(<MysteryExperience onAnswer={onAnswer} onObjectSelected={vi.fn()} />);

    await user.type(screen.getByLabelText('Your answer'), 'a real answer');
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    const ledger = document.querySelector('[data-issue-ledger]');
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(ledger).toHaveTextContent('1 / 7');
  });

});
