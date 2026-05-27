import type { Metadata, Viewport } from 'next';
import { Cormorant, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const cormorant = Cormorant({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B1220',
};

export const metadata: Metadata = {
  title: 'Astradio — Astrological Wheel Composer',
  description: 'Generate personalized 60-second musical compositions based on your astrological chart',
  keywords: ['astrology', 'music', 'composition', 'wheel', 'chart'],
  authors: [{ name: 'Astradio Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="aurora" className={`${manrope.variable} ${cormorant.variable} starfield`}>
      <head>
        {/* tfjs/wheel: use npm imports in page as needed. No legacy script tags. Lyria-only audio. */}
      </head>
      <body className="min-h-screen bg-bg text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
