import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { InterviewFlow } from '@/components/experience/InterviewFlow';
import type { QuestionDefinition } from '@/domain/experience/types';

async function answerText(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.type(screen.getByLabelText('Your answer'), value);
  await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
}

describe('InterviewFlow', () => {
  test('keeps the object hidden through seven traces, supports Q3 choice and optional Q7, then closes the information gap', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(<InterviewFlow onAnswer={onAnswer} onComplete={onComplete} />);

    expect(screen.getByText('01 / 07')).toBeInTheDocument();
    expect(screen.queryByText(/tee|hoodie|hat|product|garment/i)).not.toBeInTheDocument();

    await answerText(user, 'old maps, weather systems, forgotten machines');
    expect(screen.getByText('02 / 07')).toBeInTheDocument();
    await answerText(user, 'a cabin above a foggy valley');

    expect(screen.getByText('03 / 07')).toBeInTheDocument();
    await user.click(screen.getByLabelText('4 a.m.'));
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    expect(screen.getByText('04 / 07')).toBeInTheDocument();
    await answerText(user, 'quiet does not mean uncertain');
    await answerText(user, 'a strange old song with too much bass');
    await answerText(user, 'literal portraits');

    expect(screen.getByText('07 / 07')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeEnabled();
    expect(screen.queryByText(/tee|hoodie|hat|product|garment/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    expect(onAnswer).toHaveBeenCalledTimes(7);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeInTheDocument();
    expect(screen.getByText('You decide what it exists on.')).toBeInTheDocument();
  });

  test('renders the seven prompts assigned to this experience instead of global defaults', () => {
    const assigned = Array.from({ length: 7 }, (_, index) => ({
      id: `q${index + 1}`,
      prompt: `Assigned prompt ${index + 1}`,
      kind: 'text',
      optional: index === 6,
    })) as QuestionDefinition[];

    render(<InterviewFlow questions={assigned} onAnswer={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Assigned prompt 1' })).toBeInTheDocument();
    expect(screen.queryByText("So tell me. What's your favourite book?")).not.toBeInTheDocument();
  });
});
