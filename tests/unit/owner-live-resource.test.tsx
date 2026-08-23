import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveResource } from '@/components/ops/useLiveResource';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useLiveResource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads immediately and refreshes on a visible interval', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });

    const { result } = renderHook(() => useLiveResource({ load, intervalMs: 10_000 }));

    await waitFor(() => expect(result.current.data).toEqual({ count: 1 }));
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    await waitFor(() => expect(result.current.data).toEqual({ count: 2 }));
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.updatedAt).toBeInstanceOf(Date);
  });

  it('does not poll while hidden and refreshes when the tab becomes visible again', async () => {
    const load = vi.fn().mockResolvedValue({ count: 1 });
    renderHook(() => useLiveResource({ load, intervalMs: 10_000 }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => setVisibility('hidden'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(load).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('refreshes on window focus and exposes manual refresh without mutation side effects', async () => {
    const load = vi.fn().mockResolvedValue({ count: 1 });
    const { result } = renderHook(() => useLiveResource({ load, intervalMs: 60_000 }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    await act(async () => {
      await result.current.refresh();
    });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('never lets a slower older request overwrite a newer response', async () => {
    const first = deferred<{ version: number }>();
    const second = deferred<{ version: number }>();
    const load = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useLiveResource({ load, intervalMs: 60_000 }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    let secondRefresh!: Promise<void>;
    act(() => {
      secondRefresh = result.current.refresh();
    });
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve({ version: 2 });
      await secondRefresh;
    });
    expect(result.current.data).toEqual({ version: 2 });

    await act(async () => {
      first.resolve({ version: 1 });
      await first.promise;
    });
    expect(result.current.data).toEqual({ version: 2 });
  });

  it('surfaces load failures but preserves the last good data and can recover', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('Owner data unavailable'))
      .mockResolvedValueOnce({ count: 2 });
    const { result } = renderHook(() => useLiveResource({ load, intervalMs: 60_000 }));

    await waitFor(() => expect(result.current.data).toEqual({ count: 1 }));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.data).toEqual({ count: 1 });
    expect(result.current.error).toBe('Owner data unavailable');

    await act(async () => { await result.current.refresh(); });
    expect(result.current.data).toEqual({ count: 2 });
    expect(result.current.error).toBeNull();
  });
});
