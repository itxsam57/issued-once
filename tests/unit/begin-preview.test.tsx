import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BeginPage from '@/app/begin/page';
import { QUESTIONS } from '@/domain/experience/questions';

const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

describe('BEGIN route deployment mode', () => {
  test('Vercel preview enters the isolated owner-test experience', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');

    render(BeginPage());

    expect(screen.getByText('OWNER PREVIEW / NO PAYMENT')).toBeInTheDocument();
    expect(screen.getByText('01 / 07')).toBeInTheDocument();
  });

  test('Vercel production keeps the real public experience', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      stage: 'INTERVIEW',
      initialPosition: 0,
      interviewComplete: false,
      questions: QUESTIONS,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));

    render(BeginPage());

    expect(screen.queryByText('OWNER PREVIEW / NO PAYMENT')).not.toBeInTheDocument();
    expect(screen.queryByText('VISUAL QA / NOT PRODUCTION')).not.toBeInTheDocument();
    expect(await screen.findByText('01 / 07')).toBeInTheDocument();
  });
});
