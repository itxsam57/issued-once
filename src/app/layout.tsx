import type { Metadata } from 'next';
import { PUBLIC_METADATA } from '@/brand/publicMetadata';
import './globals.css';
import './object-stage.css';

export const metadata: Metadata = PUBLIC_METADATA;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
