import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
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
} as const;

const baseColorCatalog = {
  tee: {
    S: [{ code: 'black', label: 'Black', swatch: '#171713' }],
    M: [
      { code: 'bone', label: 'Bone', swatch: '#e8e0cf' },
      { code: 'black', label: 'Black', swatch: '#171713' },
    ],
  },
} as const;

test('shows only colors available for the locked object and size', async () => {
  const user = userEvent.setup();
  const onBaseColorConfirmed = vi.fn().mockResolvedValue(undefined);

  render(
    <MysteryExperience
      onAnswer={vi.fn().mockResolvedValue(undefined)}
      onObjectSelected={vi.fn().mockResolvedValue(undefined)}
      sizeCatalog={sizeCatalog}
      onSizeConfirmed={vi.fn().mockResolvedValue(undefined)}
      baseColorCatalog={baseColorCatalog}
      onBaseColorConfirmed={onBaseColorConfirmed}
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
  await user.click(screen.getByRole('radio', { name: /Medium/ }));
  await user.click(screen.getByRole('button', { name: 'CONFIRM SIZE' }));

  expect(screen.getByRole('heading', { name: 'Color your issue.' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Bone' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Black' })).toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: 'Bone' }));
  await user.click(screen.getByRole('button', { name: 'LOCK BASE' }));

  expect(onBaseColorConfirmed).toHaveBeenCalledWith({
    object: 'tee',
    sizeCode: 'M',
    colorCode: 'bone',
  });
});
