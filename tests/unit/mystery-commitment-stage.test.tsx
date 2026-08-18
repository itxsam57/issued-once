import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { MysteryExperience } from '@/components/experience/MysteryExperience';

async function answerText(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.type(screen.getByLabelText('Your answer'), value);
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
}

const sizeCatalog = {
  tee: [{ code: 'M', label: 'Medium', measurements: 'Chest 20 in · Length 29 in' }],
} as const;

const baseColorCatalog = {
  tee: {
    M: [{ code: 'bone', label: 'Bone', swatch: '#e8e0cf' }],
  },
} as const;

const quote = {
  quoteId: 'qa-live-quote-001',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: '2026-08-18T06:00:00.000Z',
} as const;

test('fetches a live quote for the locked variant before exposing commitment', async () => {
  const user = userEvent.setup();
  const getCommitmentQuote = vi.fn().mockResolvedValue(quote);
  const onCheckoutRequested = vi.fn().mockResolvedValue(undefined);

  render(
    <MysteryExperience
      onAnswer={vi.fn().mockResolvedValue(undefined)}
      onObjectSelected={vi.fn().mockResolvedValue(undefined)}
      sizeCatalog={sizeCatalog}
      onSizeConfirmed={vi.fn().mockResolvedValue(undefined)}
      baseColorCatalog={baseColorCatalog}
      onBaseColorConfirmed={vi.fn().mockResolvedValue(undefined)}
      getCommitmentQuote={getCommitmentQuote}
      onCheckoutRequested={onCheckoutRequested}
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
  await user.click(screen.getByRole('radio', { name: 'Bone' }));
  await user.click(screen.getByRole('button', { name: 'LOCK BASE' }));

  expect(getCommitmentQuote).toHaveBeenCalledWith({
    object: 'tee',
    sizeCode: 'M',
    colorCode: 'bone',
  });
  expect(screen.getByRole('heading', { name: 'From here, it becomes ours to interpret.' })).toBeInTheDocument();
  expect(screen.getByText('TEE / M / BONE')).toBeInTheDocument();
  expect(screen.getByText('$54.00')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'ISSUE MINE' }));
  expect(onCheckoutRequested).toHaveBeenCalledWith('qa-live-quote-001');
});
