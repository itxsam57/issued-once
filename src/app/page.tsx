import Link from 'next/link';

export default function Home() {
  return (
    <main className="home-shell">
      <section className="home-hero" aria-labelledby="entry-prompt">
        <header className="home-shell__header">
          <span className="home-shell__brand">ISSUED ONCE</span>
          <span className="home-shell__status">STATUS / UNISSUED</span>
        </header>

        <div className="home-hero__body">
          <span className="home-shell__index">ENTRY / 00</span>
          <h1 id="entry-prompt">
            A piece of your mind.
            <br />
            Issued for you.
          </h1>
        </div>

        <div className="home-hero__foot">
          <span aria-hidden="true">ISSUE / NOT YET</span>
          <Link className="entry-link" href="/begin">
            BEGIN <span aria-hidden="true">↘</span>
          </Link>
        </div>
      </section>

      <section className="home-thought home-thought--first" aria-labelledby="thought-one">
        <p className="home-story__index">TRACE / 01</p>
        <h2 id="thought-one">Nothing has to appear literally to still be there.</h2>
        <div className="home-thought__orbit" aria-hidden="true" />
      </section>

      <section className="home-thought home-thought--second" aria-labelledby="thought-two">
        <p className="home-story__index">AFTER / 07</p>
        <h2 id="thought-two">
          You may recognize where it came from without knowing how it got there.
        </h2>
      </section>

      <section className="home-enough" aria-labelledby="enough-heading">
        <div>
          <p className="home-story__index">SEVEN / ENOUGH</p>
          <h2 id="enough-heading">Seven questions are enough.</h2>
        </div>
        <Link className="entry-link entry-link--large" href="/begin">
          BEGIN <span aria-hidden="true">↘</span>
        </Link>
      </section>

      <section id="privacy" className="home-privacy" aria-labelledby="privacy-heading">
        <p className="home-story__index">YOUR ANSWERS</p>
        <h2 id="privacy-heading">
          Some of this might get personal. It doesn&apos;t need to become public.
        </h2>
        <div className="home-privacy__copy">
          <p>What you tell us is there to shape your issue.</p>
          <p>It isn&apos;t part of a public profile. It isn&apos;t something another customer gets to browse.</p>
        </div>
      </section>

      <footer className="home-shell__footer home-shell__footer--final">
        <span>ISSUED ONCE / 2026</span>
        <nav aria-label="Footer">
          <a href="#privacy">PRIVACY</a>
          <Link href="/begin">BEGIN</Link>
        </nav>
      </footer>
    </main>
  );
}
