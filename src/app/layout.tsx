import type { Metadata } from 'next';
import { PUBLIC_METADATA } from '@/brand/publicMetadata';
import './globals.css';
import './object-stage.css';
import './size-stage.css';
import './base-stage.css';
import './commitment-stage.css';
import './secret-motion.css';

export const metadata: Metadata = PUBLIC_METADATA;

// Hostinger's managed prerender cache can serve static HTML before Next.js Proxy
// response headers are applied. Keep HTML routes server-rendered so the security
// header baseline is emitted consistently; immutable Next assets remain cached.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
