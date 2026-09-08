import Link from 'next/link';
import styles from './public-utility-header.module.css';

export function PublicUtilityHeader({
  center = 'ISSUE / NOT YET',
}: {
  center?: string;
}) {
  return (
    <header className={styles.header} data-public-header>
      <Link className={styles.brand} href="/">ISSUED ONCE</Link>
      <span className={styles.center}>{center}</span>
      <nav className={styles.utilities} aria-label="Utility">
        <Link href="/store-info">INFO</Link>
        <Link href="/issue">STATUS</Link>
      </nav>
    </header>
  );
}
