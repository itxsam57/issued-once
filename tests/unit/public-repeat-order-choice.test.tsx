import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUESTIONS } from '@/domain/experience/questions';
import { PublicInterviewExperience } from '@/components/experience/PublicInterviewExperience';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PublicInterviewExperience repeat ordering', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers an explicit repeat choice and reuse jumps straight to a clean form-selection order', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/experience/start') {
        return jsonResponse({
          entryMode: 'repeat-choice',
          stage: 'CHECKOUT_STARTED',
          initialPosition: 7,
          interviewComplete: true,
          questions: [],
        });
      }
      if (path === '/api/experience/repeat') {
        expect(JSON.parse(String(init?.body))).toEqual({ choice: 'reuse' });
        return jsonResponse({
          entryMode: 'form',
          stage: 'PROFILE_COMPLETE',
          initialPosition: 7,
          interviewComplete: true,
          questions: [],
        });
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PublicInterviewExperience />);

    expect(await screen.findByRole('heading', { name: 'MAKE ANOTHER ONE?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KEEP PREVIOUS ANSWERS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ANSWER AGAIN' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'KEEP PREVIOUS ANSWERS' }));

    expect(
      await screen.findByRole('heading', { name: 'Pick the shape your issue lives on.' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answer again rotates into the newly assigned seven-question interview', async () => {
    const user = userEvent.setup();
    const rotatedQuestions = QUESTIONS.map((question, index) => ({
      ...question,
      prompt: `Fresh trace ${index + 1}`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/experience/start') {
        return jsonResponse({
          entryMode: 'repeat-choice',
          stage: 'CHECKOUT_STARTED',
          initialPosition: 7,
          interviewComplete: true,
          questions: [],
        });
      }
      if (path === '/api/experience/repeat') {
        expect(JSON.parse(String(init?.body))).toEqual({ choice: 'fresh' });
        return jsonResponse({
          entryMode: 'interview',
          stage: 'QUESTION_1',
          initialPosition: 1,
          interviewComplete: false,
          questions: rotatedQuestions,
        });
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PublicInterviewExperience />);
    await user.click(await screen.findByRole('button', { name: 'ANSWER AGAIN' }));

    expect(await screen.findByText('Fresh trace 1')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
