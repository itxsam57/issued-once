import Link from 'next/link';
import styles from './reference-header.module.css';

type ReferenceHeaderProps = {
  center?: string;
};

export function ReferenceHeader({ center = 'ISSUE / NOT YET' }: ReferenceHeaderProps) {
  return (
    <header className={styles.header} data-public-header data-reference-header>
      <Link className={styles.brand} href="/">ISSUED ONCE</Link>
      <span className={styles.center}>{center}</span>
      <nav className={styles.utilities} aria-label="Utility">
        <Link href="/store-info">INFO</Link>
        <Link href="/issue">STATUS</Link>
      </nav>
    </header>
  );
}
