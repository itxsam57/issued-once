import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { MysteryExperience } from '@/components/experience/MysteryExperience';

async function answerText(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.type(screen.getByLabelText('Your answer'), value);
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
}

const sizeCatalog = {
  tee: [
    { code: 'S', label: 'Small', measurements: 'Chest 18 in · Length 28 in' },
    { code: 'M', label: 'Medium', measurements: 'Chest 20 in · Length 29 in' },
  ],
  hoodie: [{ code: 'M', label: 'Medium', measurements: 'Chest 22 in · Length 27 in' }],
  hat: [{ code: 'OS', label: 'One size', measurements: 'Adjustable closure' }],
} as const;

test('loads the selected form size facts and requires confirmation before the next phase', async () => {
  const user = userEvent.setup();
  const onSizeConfirmed = vi.fn().mockResolvedValue(undefined);

  render(
    <MysteryExperience
      onAnswer={vi.fn().mockResolvedValue(undefined)}
      onObjectSelected={vi.fn().mockResolvedValue(undefined)}
      sizeCatalog={sizeCatalog}
      onSizeConfirmed={onSizeConfirmed}
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
  await user.click(screen.getByRole('button', { name: 'UNLOCK FORM' }));

  await user.click(screen.getByRole('radio', { name: 'TEE' }));
  await user.click(screen.getByRole('button', { name: 'LOCK FORM' }));

  expect(screen.getByRole('heading', { name: 'Choose the size it should become.' })).toBeInTheDocument();
  expect(screen.getByText('Chest 20 in · Length 29 in')).toBeInTheDocument();
  expect(screen.queryByText('Adjustable closure')).not.toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: /Medium/ }));
  await user.click(screen.getByRole('button', { name: 'CONFIRM SIZE' }));

  expect(onSizeConfirmed).toHaveBeenCalledWith({ object: 'tee', sizeCode: 'M' });
});
