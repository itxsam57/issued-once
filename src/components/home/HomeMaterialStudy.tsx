'use client';

import type { CSSProperties, PointerEvent } from 'react';

type Props = { className?: string };

type PointerStyle = CSSProperties & {
  '--pointer-x': string;
  '--pointer-y': string;
};

export function HomeMaterialStudy({ className }: Props) {
  function move(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.width > 0 ? event.clientX - bounds.left : event.clientX;
    const y = bounds.height > 0 ? event.clientY - bounds.top : event.clientY;
    event.currentTarget.style.setProperty('--pointer-x', `${Math.round(x)}px`);
    event.currentTarget.style.setProperty('--pointer-y', `${Math.round(y)}px`);
  }

  return (
    <div
      aria-hidden="true"
      className={className}
      data-testid="home-material-study"
      onPointerMove={move}
      style={{ '--pointer-x': '50%', '--pointer-y': '50%' } as PointerStyle}
    >
      <span data-material-layer="mass" />
      <span data-material-layer="edge" />
      <span data-material-layer="light" />
    </div>
  );
}
