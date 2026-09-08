'use client';

import type { CSSProperties, PointerEvent } from 'react';
import styles from './reference-hero-presence.module.css';

type PresenceStyle = CSSProperties & { '--x': string; '--y': string };

export function ReferenceHeroPresence() {
  function move(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.width ? ((event.clientX - box.left) / box.width) * 100 : 50;
    const y = box.height ? ((event.clientY - box.top) / box.height) * 100 : 50;
    event.currentTarget.style.setProperty('--x', `${Math.max(0, Math.min(100, x)).toFixed(1)}%`);
    event.currentTarget.style.setProperty('--y', `${Math.max(0, Math.min(100, y)).toFixed(1)}%`);
  }

  return (
    <div
      className={styles.presence}
      data-testid="reference-hero-presence"
      aria-hidden="true"
      onPointerMove={move}
      style={{ '--x': '50%', '--y': '50%' } as PresenceStyle}
    >
      <span className={styles.shadow} />
      <span className={styles.mass} />
      <span className={styles.orbit} />
      <span className={styles.light} />
    </div>
  );
}
