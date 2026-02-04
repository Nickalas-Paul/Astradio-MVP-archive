import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
    <html lang="en" data-theme="aurora" className="starfield">
      <head>
        {/* Tone/tfjs/wheel: use npm imports (e.g. dynamic import('tone') in page.tsx). No legacy script tags. */}
      </head>
      <body className={`${inter.className} min-h-screen bg-bg text-text-primary antialiased`}>
        {children}
      </body>
    </html>
  );
}
