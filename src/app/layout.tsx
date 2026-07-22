import type { Metadata } from 'next';
import { Geist, Geist_Mono, JetBrains_Mono } from 'next/font/google';
import { NO_FLASH_SCRIPT, SW_REGISTER_SCRIPT } from '@/lib/theme';
import { UserProvider } from '@/lib/user';
import { EntriesProvider } from '@/lib/entries-provider';
import { SocialProvider } from '@/lib/social';
import { AppShell } from '@/components/layout/app-shell';
import { InstallToast } from '@/components/layout/install-toast';
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

// Clasament (Claude Design "Restructurare modul clasament") is set in
// JetBrains Mono — scoped via this variable, the rest of the app stays Geist.
const jbMono = JetBrains_Mono({
  variable: '--font-jbmono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'somn · sleep for IT people',
  description: 'Sleep Score, REM, RHR & HRV tracker for the team — gamified, ruthlessly minimal.',
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
    description: 'Sleep Score, REM, RHR & HRV tracker — gamified, ruthlessly minimal.',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'somn',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'somn · sleep for IT people',
    description: 'Sleep Score, REM, RHR & HRV tracker — gamified, ruthlessly minimal.',
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
    // suppressHydrationWarning: the NO_FLASH_SCRIPT below mutates the
    // <html> classList synchronously before React hydrates (to apply
    // the saved theme without a flash). That's an intentional mismatch
    // between SSR and client — silence the warning here only.
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} ${jbMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply saved theme before hydration to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {/* Register the service worker. Inline so crawlers (PWABuilder,
            Lighthouse) see the registration without executing React. */}
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
      </head>
      <body className="antialiased">
        <UserProvider>
          <EntriesProvider>
            <SocialProvider>
              <AppShell>{children}</AppShell>
              <InstallToast />
            </SocialProvider>
          </EntriesProvider>
        </UserProvider>
      </body>
    </html>
  );
}
