'use client';

import type { ReactNode } from 'react';
import styles from './owner-os.module.css';

export const OWNER_OS_SECTIONS = [
  'Home',
  'Issues',
  'Designer',
  'Manufacturing',
  'Sales',
  'Customers',
  'Support',
  'Website',
  'System',
  'Audit',
] as const;

export type OwnerOsSection = (typeof OWNER_OS_SECTIONS)[number];

export function OwnerOsShell({
  active,
  onNavigate,
  onLogout,
  children,
}: {
  active: OwnerOsSection;
  onNavigate: (section: OwnerOsSection) => void;
  onLogout?: () => void;
  children: ReactNode;
}) {
  return (
    <main className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.brand}>
          <span>ISSUED ONCE</span>
          <strong>OWNER OS</strong>
        </div>
        <nav className={styles.nav} aria-label="Owner OS">
          {OWNER_OS_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              aria-current={active === section ? 'page' : undefined}
              onClick={() => onNavigate(section)}
            >
              {section}
            </button>
          ))}
        </nav>
        {onLogout ? (
          <button type="button" className={styles.logout} onClick={onLogout}>CLOSE ROOM</button>
        ) : null}
      </aside>
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <span>CONTROL PLANE / {active.toUpperCase()}</span>
          <span>PRIVATE</span>
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  );
}
