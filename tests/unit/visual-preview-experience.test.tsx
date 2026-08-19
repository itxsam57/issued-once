import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { VisualPreviewExperience } from '@/components/preview/VisualPreviewExperience';

async function continueText(user: ReturnType<typeof userEvent.setup>, answer: string) {
  await user.type(screen.getByLabelText('Your answer'), answer);
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
}

describe('VisualPreviewExperience', () => {
  test('renders the real mystery components with an unmistakable non-production marker', () => {
    render(<VisualPreviewExperience />);

    expect(screen.getByText('VISUAL QA / NOT PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('01 / 07')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "So tell me. What's your favourite book?" })).toBeInTheDocument();
    expect(screen.queryByText(/tee|hoodie|hat|cap|tote|shop now/i)).not.toBeInTheDocument();
  });

  test('owner preview covers contact and destination then completes without opening production payment', async () => {
    const user = userEvent.setup();
    render(<VisualPreviewExperience mode="owner" />);

    expect(screen.getByText('PREVIEW OTP / 123456')).toBeInTheDocument();

    await continueText(user, 'The Master and Margarita');
    await continueText(user, 'a quiet cabin above a valley');
    await user.click(screen.getByLabelText('4 a.m.'));
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
    await continueText(user, 'quiet does not mean uncertain');
    await continueText(user, 'a song that feels older than it is');
    await continueText(user, 'literal portraits');
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    await user.click(screen.getByRole('button', { name: 'UNLOCK FORM' }));
    await user.click(screen.getByRole('radio', { name: 'TEE' }));
    await user.click(screen.getByRole('button', { name: 'LOCK FORM' }));
    await user.click(screen.getByRole('radio', { name: /Medium/ }));
    await user.click(screen.getByRole('button', { name: 'CONFIRM SIZE' }));
    await user.click(screen.getByRole('radio', { name: 'Bone' }));
    await user.click(screen.getByRole('button', { name: 'LOCK BASE' }));

    expect(screen.getByRole('heading', { name: 'Where do we find you?' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'preview@example.com');
    await user.click(screen.getByRole('button', { name: 'SEND CODE' }));
    await user.type(screen.getByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'VERIFY' }));

    expect(screen.getByRole('heading', { name: 'Where does it go?' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Preview Customer');
    await user.type(screen.getByLabelText('Address'), '1 Preview Street');
    await user.type(screen.getByLabelText('City'), 'Peshawar');
    await user.type(screen.getByLabelText('Postal code'), '25000');
    await user.selectOptions(screen.getByLabelText('Country'), 'PK');
    await user.click(screen.getByRole('button', { name: 'USE THIS ADDRESS' }));

    expect(await screen.findByText('$54.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ISSUE MINE' }));

    expect(await screen.findByRole('heading', { name: 'PREVIEW COMPLETE.' })).toBeInTheDocument();
    expect(screen.getByText('No payment was attempted.')).toBeInTheDocument();
  });
});
