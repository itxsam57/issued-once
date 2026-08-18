import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>ISSUED ONCE</h1>
      <p>There is something here that does not exist yet.</p>
      <Link href="/begin">BEGIN</Link>
    </main>
  );
}
