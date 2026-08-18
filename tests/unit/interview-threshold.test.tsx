import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { InterviewFlow } from '@/components/experience/InterviewFlow';

async function answerText(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.type(screen.getByLabelText('Your answer'), value);
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
}

test('profile closure pauses before a deliberate form unlock', async () => {
  const user = userEvent.setup();
  const onProceed = vi.fn();

  render(
    <InterviewFlow
      onAnswer={vi.fn().mockResolvedValue(undefined)}
      onProceed={onProceed}
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
  expect(screen.getByText('You decide what it exists on.')).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'UNLOCK FORM' }));
  expect(onProceed).toHaveBeenCalledTimes(1);
});
