import type { Metadata } from 'next';
import './globals.css';
import './object-stage.css';

export const metadata: Metadata = {
  title: 'ISSUED ONCE',
  description: 'A mystery-first one-of-one apparel experience.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
