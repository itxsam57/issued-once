import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { MysteryExperience } from '@/components/experience/MysteryExperience';

async function answerText(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.type(screen.getByLabelText('Your answer'), value);
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
}

test('moves from private traces through a threshold into physical form selection', async () => {
  const user = userEvent.setup();
  const onAnswer = vi.fn().mockResolvedValue(undefined);
  const onObjectSelected = vi.fn().mockResolvedValue(undefined);

  render(
    <MysteryExperience
      onAnswer={onAnswer}
      onObjectSelected={onObjectSelected}
    />,
  );

  await answerText(user, 'maps, storms, machines');
  await answerText(user, 'a cabin above fog');
  await user.click(screen.getByLabelText('4 a.m.'));
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
  await answerText(user, 'quiet is not uncertain');
  await answerText(user, 'a strange old song');
  await answerText(user, 'literal portraits');
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

  expect(screen.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'TEE' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'UNLOCK FORM' }));
  expect(screen.getByRole('heading', { name: 'Choose what it exists on.' })).toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: 'TEE' }));
  await user.click(screen.getByRole('button', { name: 'LOCK FORM' }));

  expect(onAnswer).toHaveBeenCalledTimes(7);
  expect(onObjectSelected).toHaveBeenCalledWith('tee');
});
