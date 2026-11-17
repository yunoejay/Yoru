import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ThemeProvider from '../components/ThemeProvider';

/** Base URL for absolute metadata (OG, canonical). Set APP_URL in production. */
const siteUrl = process.env.APP_URL || 'http://localhost:3000';

/** Tab title (kept short on purpose). */
const title = 'Yoru';
/** Longer title used only for social-share cards, where context helps. */
const shareTitle = 'Yoru — Read manhwa, manhua, and manga';
const description =
  'A cleaner home for manhwa (Korean), manhua (Chinese), and manga (Japanese): fast discovery, per-chapter scanlator credit, and a vertical-scroll reader built for bingeing.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: '%s · Yoru' },
  description,
  applicationName: 'Yoru',
  keywords: ['manhwa', 'manhua', 'manga', 'webtoon', 'korean manhwa', 'chinese manhua', 'japanese manga', 'scanlation', 'reader'],
  authors: [{ name: 'Yoru' }],
  creator: 'Yoru',
  openGraph: {
    type: 'website',
    siteName: 'Yoru',
    title: shareTitle,
    description,
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yoru',
    description: 'Read manhwa, manhua, and manga in a cleaner, faster reader.',
  },
  robots: { index: true, follow: true },
  icons: {
    // /favicon.ico is the URL stale browser caches re-check (and the only one
    // Safari and older engines look at, since they skip SVG favicons); the SVG
    // is preferred where supported. Regenerate the rasters with `npm run icons:build`.
    //
    // The `?v=2` suffix busts the browser's separate favicon cache: browsers key
    // that cache by exact URL, so after the Rogue -> Yoru rebrand the old "R"
    // kept showing until the URL itself changed. Bump it whenever the mark
    // changes again (see scripts/generate-icons.ts).
    icon: [
      { url: '/favicon.ico?v=2', sizes: '16x16 32x32 48x48' },
      { url: '/icon.svg?v=2', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=2', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1115' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <Navbar />
          <main className="container-padded w-full flex-1 py-6">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
