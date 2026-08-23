'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type LiveResourceOptions<T> = {
  load: () => Promise<T>;
  intervalMs: number;
  enabled?: boolean;
};

type LiveResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: Date | null;
  refresh: () => Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Owner data unavailable';
}

export function useLiveResource<T>({
  load,
  intervalMs,
  enabled = true,
}: LiveResourceOptions<T>): LiveResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const loadRef = useRef(load);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);

  loadRef.current = load;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const generation = ++generationRef.current;
    if (mountedRef.current) setLoading(true);

    try {
      const next = await loadRef.current();
      if (!mountedRef.current || generation !== generationRef.current) return;
      setData(next);
      setError(null);
      setUpdatedAt(new Date());
    } catch (cause) {
      if (!mountedRef.current || generation !== generationRef.current) return;
      setError(errorMessage(cause));
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
        generationRef.current += 1;
      };
    }

    void refresh();

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(refreshIfVisible, intervalMs);
    const onFocus = () => refreshIfVisible();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs, refresh]);

  return { data, error, loading, updatedAt, refresh };
}
