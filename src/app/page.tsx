import Link from 'next/link';
import { ReferenceHeader } from '@/components/reference/ReferenceHeader';
import { ReferenceHeroPresence } from '@/components/reference/ReferenceHeroPresence';
import styles from './home.module.css';

export default function Home() {
  return (
    <main className={styles.home} data-testid="reference-home" data-reference-surface="home">
      <ReferenceHeader />

      <section className={styles.hero} aria-labelledby="entry-prompt">
        <div className={styles.heroCopy}>
          <p className={styles.technical}>ISSUE / NOT YET <span>1 / 1</span></p>
          <h1 id="entry-prompt" aria-label="A piece of your mind. Issued for you.">
            A piece of your mind.
            <br />
            <em>Issued for you.</em>
          </h1>
          <Link className={styles.start} href="/begin">START <span aria-hidden="true">↘</span></Link>
        </div>
        <ReferenceHeroPresence />
      </section>

      <section className={styles.scene} aria-label="Seven questions">
        <strong>7</strong>
        <p>questions are enough.</p>
      </section>

      <section className={`${styles.scene} ${styles.sceneRight}`} aria-label="One design">
        <strong>1</strong>
        <p>design.</p>
      </section>

      <section className={styles.scene} aria-label="One of one">
        <strong>1 / 1</strong>
        <p>exists once.</p>
      </section>

      <section className={styles.issue} aria-labelledby="current-issue-heading">
        <p className={styles.technical}>CURRENT ISSUE</p>
        <h2 id="current-issue-heading" aria-label="Issue allocated after payment">—</h2>
        <div className={styles.issueFacts}>
          <span>HIDDEN</span>
          <span>1 / 1</span>
          <span>AVAILABLE</span>
        </div>
      </section>

      <section className={styles.finalCta}>
        <Link href="/begin">BEGIN.</Link>
      </section>

      <footer className={styles.footer}>
        <span>ISSUED ONCE / 2026</span>
        <nav aria-label="Footer">
          <Link href="/store-info">STORE INFO</Link>
          <Link href="/contact">CONTACT</Link>
          <Link href="/terms">TERMS</Link>
          <Link href="/returns">RETURNS</Link>
          <Link href="/cookies">COOKIES</Link>
        </nav>
      </footer>
    </main>
  );
}
