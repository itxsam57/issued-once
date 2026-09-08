import type { ObjectType } from './ObjectSelection';
import styles from './ritual-shell.module.css';

export type IssueLedgerState = {
  answered: number;
  object?: ObjectType | null;
  size?: string | null;
  base?: string | null;
};

type LedgerRow = { label: string; value: string };

function rows(state: IssueLedgerState): LedgerRow[] {
  const result: LedgerRow[] = [
    { label: 'ISSUE', value: 'NOT YET' },
    { label: 'ANSWERS', value: `${Math.min(Math.max(state.answered, 0), 7)} / 7` },
  ];
  if (state.object) result.push({ label: 'OBJECT', value: state.object.toUpperCase() });
  if (state.size) result.push({ label: 'SIZE', value: state.size.toUpperCase() });
  if (state.base) result.push({ label: 'BASE', value: state.base.toUpperCase() });
  return result;
}

export function IssueLedger({ state, mobile = false }: { state: IssueLedgerState; mobile?: boolean }) {
  return (
    <div className={mobile ? styles.mobileLedgerBody : styles.ledgerBody}>
      {rows(state).map((row) => (
        <div className={styles.ledgerRow} key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
