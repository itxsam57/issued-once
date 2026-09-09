import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ReturningSessionChoice } from '@/components/experience/ReturningSessionChoice';

test('returning customer must explicitly continue or start again', async () => {
  const user = userEvent.setup();
  const onContinue = vi.fn();
  const onStartAgain = vi.fn(async () => undefined);

  render(
    <ReturningSessionChoice
      onContinue={onContinue}
      onStartAgain={onStartAgain}
    />,
  );

  expect(screen.getByRole('heading', { name: /pick up where you left off/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'START AGAIN' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
  expect(onContinue).toHaveBeenCalledTimes(1);
  expect(onStartAgain).not.toHaveBeenCalled();
});

test('START AGAIN is single-submit while a fresh session is being created', async () => {
  const user = userEvent.setup();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const onStartAgain = vi.fn(() => pending);

  render(
    <ReturningSessionChoice
      onContinue={() => undefined}
      onStartAgain={onStartAgain}
    />,
  );

  const startAgain = screen.getByRole('button', { name: 'START AGAIN' });
  await user.click(startAgain);
  await user.click(startAgain);
  expect(onStartAgain).toHaveBeenCalledTimes(1);
  expect(startAgain).toBeDisabled();
  release();
});
