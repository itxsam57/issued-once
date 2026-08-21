import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './merchant.module.css';

export function MerchantPageShell({
  kicker,
  title,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">ISSUED ONCE</Link>
        <Link className={styles.back} href="/begin">BEGIN ↘</Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        <p className={styles.intro}>{intro}</p>
      </section>

      <div className={styles.grid}>{children}</div>

      <footer className={styles.footer}>
        <span>ISSUED ONCE / 2026</span>
        <nav aria-label="Merchant information">
          <Link href="/store-info">STORE INFO</Link>
          <Link href="/contact">CONTACT</Link>
          <Link href="/terms">TERMS</Link>
          <Link href="/returns">RETURNS</Link>
        </nav>
      </footer>
    </main>
  );
}
