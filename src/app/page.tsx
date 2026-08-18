import Link from 'next/link';
import styles from './home.module.css';

export default function Home() {
  return (
    <main className={styles.story}>
      <section className={styles.hero} aria-labelledby="entry-prompt">
        <header className={styles.header}>
          <span className={styles.brand}>ISSUED ONCE</span>
          <span className={styles.status}>STATUS / UNISSUED</span>
        </header>

        <div className={styles.heroBody}>
          <span className={styles.index}>ENTRY / 00</span>
          <h1 id="entry-prompt" aria-label="A piece of your mind. Issued for you.">
            A piece of your mind.
            <br />
            <em>Issued for you.</em>
          </h1>
        </div>

        <div className={styles.heroFoot}>
          <span aria-hidden="true">ISSUE / NOT YET</span>
          <Link className={styles.begin} href="/begin">
            BEGIN <span aria-hidden="true">↘</span>
          </Link>
        </div>
      </section>

      <section className={`${styles.thought} ${styles.thoughtFirst}`} aria-labelledby="thought-one">
        <p className={styles.index}>TRACE / 01</p>
        <h2 id="thought-one">Nothing has to appear literally to still be there.</h2>
        <div className={styles.orbit} aria-hidden="true" />
      </section>

      <section className={`${styles.thought} ${styles.thoughtSecond}`} aria-labelledby="thought-two">
        <p className={styles.index}>AFTER / 07</p>
        <h2 id="thought-two">
          You may recognize where it came from without knowing how it got there.
        </h2>
      </section>

      <section className={styles.enough} aria-labelledby="enough-heading">
        <div>
          <p className={styles.index}>SEVEN / ENOUGH</p>
          <h2 id="enough-heading">Seven questions are enough.</h2>
        </div>
        <Link className={`${styles.begin} ${styles.beginLarge}`} href="/begin">
          BEGIN <span aria-hidden="true">↘</span>
        </Link>
      </section>

      <section id="privacy" className={styles.privacy} aria-labelledby="privacy-heading">
        <p className={styles.index}>YOUR ANSWERS</p>
        <h2 id="privacy-heading">
          Some of this might get personal. It doesn&apos;t need to become public.
        </h2>
        <div className={styles.privacyCopy}>
          <p>What you tell us is there to shape your issue.</p>
          <p>It isn&apos;t part of a public profile. It isn&apos;t something another customer gets to browse.</p>
        </div>
      </section>

      <footer className={styles.finalFooter}>
        <span>ISSUED ONCE / 2026</span>
        <nav aria-label="Footer">
          <a href="#privacy">PRIVACY</a>
          <Link href="/begin">BEGIN</Link>
        </nav>
      </footer>
    </main>
  );
}
