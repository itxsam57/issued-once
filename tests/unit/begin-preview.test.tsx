import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BeginPage from '@/app/begin/page';

const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

describe('BEGIN route deployment mode', () => {
  test('Vercel preview enters the isolated owner-test experience', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');

    render(BeginPage());

    expect(screen.getByText('VISUAL QA / NOT PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('01 / 07')).toBeInTheDocument();
  });

  test('Vercel production keeps the real public experience', () => {
    vi.stubEnv('VERCEL_ENV', 'production');

    render(BeginPage());

    expect(screen.queryByText('VISUAL QA / NOT PRODUCTION')).not.toBeInTheDocument();
    expect(screen.getByText('01 / 07')).toBeInTheDocument();
  });
});
