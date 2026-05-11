import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NO_FLASH_SCRIPT } from '@/lib/theme';
import { UserProvider } from '@/lib/user';
import { EntriesProvider } from '@/lib/entries-provider';
import { AppShell } from '@/components/layout/app-shell';
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
  description: 'Sleep, REM, RHR & HRV tracker for the team. Built with Next.js, AI-fueled, ruthlessly minimal. Daily roasts by Claude Haiku.',
  metadataBase: new URL('https://somn-xi.vercel.app'),
  manifest: '/manifest.json',
  applicationName: 'somn',
  appleWebApp: {
    capable: true,
    title: 'somn',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'somn · sleep for IT people',
    description: 'Sleep, REM, RHR & HRV tracker. Daily roasts by Claude Haiku.',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'somn',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'somn · sleep for IT people',
    description: 'Sleep, REM, RHR & HRV tracker. Daily roasts by Claude Haiku.',
  },
  robots: {
    index: false,        // private team app — keep out of search engines
    follow: false,
  },
};

export const viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,         // allow pinch-zoom for accessibility
  userScalable: true,
  viewportFit: 'cover',    // respect notches / safe areas
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Apply saved theme before hydration to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="antialiased">
        <UserProvider>
          <EntriesProvider>
            <AppShell>{children}</AppShell>
          </EntriesProvider>
        </UserProvider>
      </body>
    </html>
  );
}
