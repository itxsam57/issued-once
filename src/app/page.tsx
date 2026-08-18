import Link from 'next/link';

export default function Home() {
  return (
    <main className="home-shell">
      <header className="home-shell__header">
        <span className="home-shell__brand">ISSUED ONCE</span>
        <span className="home-shell__status">STATUS / UNISSUED</span>
      </header>

      <section className="home-shell__prompt" aria-labelledby="entry-prompt">
        <span className="home-shell__index">ENTRY / 00</span>
        <h1 id="entry-prompt">There is something here that does not exist yet.</h1>
        <p>It needs something from you.</p>
      </section>

      <footer className="home-shell__footer">
        <span aria-hidden="true">UNKNOWN → UNRESOLVED</span>
        <Link className="entry-link" href="/begin">
          BEGIN <span aria-hidden="true">↘</span>
        </Link>
      </footer>
    </main>
  );
}
