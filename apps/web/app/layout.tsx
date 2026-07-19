import type { Metadata } from 'next';
import Link from 'next/link';
import './styles.css';

export const metadata: Metadata = {
  title: 'Plant Companion',
  description: 'A minimal web shell for future opt-in community garden infrastructure.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">Plant Companion</Link>
          <nav aria-label="Primary navigation">
            <Link href="/garden">Garden</Link>
            {' · '}
            <Link href="/auth/sign-in">Sign in</Link>
            {' · '}
            <Link href="/account">Account</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
