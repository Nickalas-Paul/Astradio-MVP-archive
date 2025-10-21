import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Astradio — Astrological Wheel Composer',
  description: 'Generate personalized 60-second musical compositions based on your astrological chart',
  keywords: ['astrology', 'music', 'composition', 'wheel', 'chart'],
  authors: [{ name: 'Astradio Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0B1220',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="aurora" className="starfield">
      <head>
        {/* Preload critical resources */}
        <link rel="preload" href="/tone.js" as="script" />
        <link rel="preload" href="/vendor/tfjs/tf.min.js" as="script" />
        <link rel="preload" href="/wheel.js" as="script" />
        
        {/* Load external dependencies */}
        <script src="/tone.js" defer />
        <script src="/vendor/tfjs/tf.min.js" defer />
        <script src="/wheel.js" defer />
        
        {/* Development tools removed: avoided serving TS as static asset */}
      </head>
      <body className={`${inter.className} min-h-screen bg-bg text-text-primary antialiased`}>
        {children}
      </body>
    </html>
  );
}
