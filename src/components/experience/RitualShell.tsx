import type { ReactNode } from 'react';
import { ReferenceHeader } from '@/components/reference/ReferenceHeader';
import { IssueLedger, type IssueLedgerState } from './IssueLedger';
import styles from './ritual-shell.module.css';

export function RitualShell({ children, ledger }: { children: ReactNode; ledger: IssueLedgerState }) {
  return (
    <div className={styles.shell} data-reference-surface="ritual">
      <ReferenceHeader />

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
