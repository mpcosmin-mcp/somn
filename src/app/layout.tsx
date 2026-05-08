import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'somn · sleep for IT people',
  description: 'Sleep, REM, RHR & HRV tracker for the team. Built with Next.js, AI-fueled, ruthlessly minimal.',
  metadataBase: new URL('https://somn.vercel.app'),
};

export const viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
