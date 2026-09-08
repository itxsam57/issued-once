import Link from 'next/link';
import type { ReactNode } from 'react';
import { IssueLedger, type IssueLedgerState } from './IssueLedger';
import styles from './ritual-shell.module.css';

export function RitualShell({ children, ledger }: { children: ReactNode; ledger: IssueLedgerState }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">ISSUED ONCE</Link>
        <span className={styles.current}>ISSUE / NOT YET</span>
        <nav className={styles.utilities} aria-label="Utility">
          <Link href="/store-info">INFO</Link>
          <Link href="/issue">STATUS</Link>
        </nav>
      </header>

      <aside className={styles.ledger} data-issue-ledger aria-label="Issue ledger">
        <IssueLedger state={ledger} />
      </aside>

      <details className={styles.mobileLedger}>
        <summary>ISSUE / NOT YET</summary>
        <IssueLedger state={ledger} mobile />
      </details>

      <main className={styles.ritual}>
        <div className={styles.ritualInner}>{children}</div>
      </main>
    </div>
  );
}
