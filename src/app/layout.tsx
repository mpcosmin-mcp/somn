import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NO_FLASH_SCRIPT } from '@/lib/theme';
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
  metadataBase: new URL('https://somn-xi.vercel.app'),
};

export const viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Apply saved theme before hydration to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
