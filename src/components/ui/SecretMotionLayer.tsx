'use client';

import { useEffect, useRef } from 'react';

export function SecretMotionLayer() {
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const light = lightRef.current;
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    if (!light || motionQuery?.matches) return;

    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        light.style.setProperty('--io-pointer-x', `${event.clientX}px`);
        light.style.setProperty('--io-pointer-y', `${event.clientY}px`);
      });
    };

    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return <div ref={lightRef} className="io-pointer-light" data-io-motion="pointer-light" aria-hidden="true" />;
}
