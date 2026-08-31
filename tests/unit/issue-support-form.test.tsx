import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IssueSupportForm,
  submitIssueSupportRequest,
} from '@/components/experience/IssueSupportForm';

describe('Issue support form', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('captures a reason and message, then shows the opaque support reference', async () => {
    const user = userEvent.setup();
    const submitRequest = vi.fn(async () => ({ id: 'support-ref-123' }));

    render(<IssueSupportForm submitRequest={submitRequest} />);

    expect(screen.getByRole('heading', { name: 'Need help?' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Reason'), 'access-recovery');
    await user.type(
      screen.getByLabelText('What happened?'),
      'I replaced my phone and need help getting back to my Issue.',
    );
    await user.click(screen.getByRole('button', { name: 'SEND TO SUPPORT' }));

    expect(submitRequest).toHaveBeenCalledWith({
      category: 'access-recovery',
      message: 'I replaced my phone and need help getting back to my Issue.',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Support request received.');
    expect(screen.getByRole('status')).toHaveTextContent('support-ref-123');
  });

  it('serializes the category into the existing support API message contract', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 'support-ref-456' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      submitIssueSupportRequest({
        category: 'delivery-tracking',
        message: 'The tracking page has not changed for three days.',
      }),
    ).resolves.toEqual({ id: 'support-ref-456' });

    expect(fetchMock).toHaveBeenCalledWith('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Reason: delivery-tracking\n\nThe tracking page has not changed for three days.',
      }),
    });
  });

  it('shows a safe retryable error without exposing response internals', async () => {
    const user = userEvent.setup();
    const submitRequest = vi.fn(async () => {
      throw new Error('database connection string leaked here');
    });

    render(<IssueSupportForm submitRequest={submitRequest} />);

    await user.selectOptions(screen.getByLabelText('Reason'), 'other');
    await user.type(screen.getByLabelText('What happened?'), 'Something else went wrong.');
    await user.click(screen.getByRole('button', { name: 'SEND TO SUPPORT' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't send your request. Please try again.",
    );
    expect(screen.queryByText(/connection string/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SEND TO SUPPORT' })).toBeEnabled();
  });
});
