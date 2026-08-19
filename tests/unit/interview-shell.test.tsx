import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { InterviewQuestion } from '@/components/experience/InterviewQuestion';
import { QUESTIONS } from '@/domain/experience/questions';

describe('InterviewQuestion', () => {
  test('reveals one question, preserves the mystery, and submits the answer', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn().mockResolvedValue(undefined);

    render(
      <InterviewQuestion
        question={QUESTIONS[0]}
        position={1}
        total={7}
        onAnswer={onAnswer}
      />,
    );

    expect(screen.getByText('01 / 07')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: QUESTIONS[0].prompt })).toBeInTheDocument();
    expect(screen.queryByText(/\b(?:tee|hoodie|hat|product|design)\b/i)).not.toBeInTheDocument();

    const field = screen.getByLabelText('Your answer');
    await user.type(field, 'old maps, storms, and forgotten machines');
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    expect(onAnswer).toHaveBeenCalledWith({
      questionId: 'q1',
      answer: 'old maps, storms, and forgotten machines',
    });
  });
});
