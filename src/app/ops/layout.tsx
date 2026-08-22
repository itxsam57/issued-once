import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ISSUED ONCE / Operations',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
