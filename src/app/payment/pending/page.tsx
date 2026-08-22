import Link from 'next/link';

export default function PaymentPendingPage() {
  return (
    <main className="public-interview">
      <section className="interview-complete" aria-live="polite">
        <p className="interview-complete__signal">PAYMENT / CHECKING</p>
        <h1>Hold this thought.</h1>
        <p>We&apos;re confirming that your issue is really yours.</p>
        <Link className="interview-complete__proceed" href="/">ISSUED ONCE</Link>
      </section>
    </main>
  );
}
