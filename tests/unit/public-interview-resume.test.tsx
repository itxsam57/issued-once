import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { PublicInterviewExperience } from '@/components/experience/PublicInterviewExperience';

const questions = [
  ['q1', 'One?'], ['q2', 'Two?'], ['q3', 'Three?'], ['q4', 'Four?'],
  ['q5', 'Five?'], ['q6', 'Six?'], ['q7', 'Seven?'],
].map(([id, prompt], index) => ({
  id,
  prompt,
  kind: 'text' as const,
  optional: index === 6,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

test('CONTINUE hydrates an already saved object and resumes directly at size selection', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/experience/start') {
      return new Response(JSON.stringify({
        stage: 'OBJECT_SELECTED',
        initialPosition: 7,
        interviewComplete: true,
        entryMode: 'profile',
        resumePrompt: true,
        questions,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url === '/api/experience/resume') {
      return new Response(JSON.stringify({
        phase: 'size',
        object: 'tee',
        sizes: [{ code: 'M', label: 'M' }, { code: 'L', label: 'L' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<PublicInterviewExperience />);

  expect(await screen.findByRole('heading', { name: 'PICK UP WHERE YOU LEFT OFF?' })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'CONTINUE' }));

  expect(await screen.findByRole('heading', { name: 'Pick your size.' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'M', exact: true })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'L', exact: true })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/experience/resume', expect.objectContaining({
    method: 'POST',
    credentials: 'same-origin',
  }));
});

test('CONTINUE from COMMITMENT_READY restores the locked physical facts and current quote without private contact data', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/experience/start') {
      return new Response(JSON.stringify({
        stage: 'COMMITMENT_READY',
        initialPosition: 7,
        interviewComplete: true,
        entryMode: 'profile',
        resumePrompt: true,
        questions,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url === '/api/experience/resume') {
      return new Response(JSON.stringify({
        phase: 'commitment',
        object: 'tee',
        sizeCode: 'M',
        color: { code: 'Black', label: 'Black' },
        quote: {
          quoteId: 'quote-resume', amountMinor: 5600, currency: 'USD',
          expiresAt: '2026-09-10T02:00:00.000Z',
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<PublicInterviewExperience />);
  await userEvent.setup().click(await screen.findByRole('button', { name: 'CONTINUE' }));

  expect(await screen.findByText('FORM COMPLETE')).toBeInTheDocument();
  expect(screen.getByText(/TEE \/ M \/ BLACK/i)).toBeInTheDocument();
  expect(screen.getByText('$56.00')).toBeInTheDocument();
  expect(screen.queryByText(/sam@example|Quiet Street|92300/i)).not.toBeInTheDocument();
});
