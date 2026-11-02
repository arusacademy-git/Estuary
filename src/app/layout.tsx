import type { Metadata } from 'next';
import {
  Poppins,
  DM_Sans as DmSans,
} from 'next/font/google';
import localFont from 'next/font/local';

import './globals.css';

const displayFont = Poppins({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

const bodyFont = DmSans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const monoFont = localFont({
  src: './fonts/FiraCode-wght.ttf',
  variable: '--font-mono',
  weight: '400 500',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Estuary',
  description: 'Internal finance operations hub prototype for Arus.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='en'
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
