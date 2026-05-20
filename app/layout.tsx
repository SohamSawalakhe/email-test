import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { NextAuthProvider } from '@/app/NextAuthProvider'
import { DashboardProvider } from '../context/dashboard-context'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Toaster } from 'sonner'
import Script from 'next/script'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://mail.gpserp.com'),
  title: {
    default: 'Mail by GPSERP - AI-Powered Email Outreach Platform',
    template: '%s | Mail by GPSERP',
  },
  description: 'AI-powered email outreach platform for personalized cold emails. Scale your campaigns with intelligent personalization and high deliverability.',
  keywords: [
    'email outreach',
    'AI email generator',
    'cold email software',
    'GPSERP',
    'email marketing automation',
    'personalized bulk email'
  ],
  authors: [{ name: 'GPSERP', url: 'https://mail.gpserp.com' }],
  creator: 'GPSERP',
  publisher: 'GPSERP',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'Mail by GPSERP - AI-Powered Email Outreach Platform',
    description: 'AI-powered email outreach platform for personalized cold emails. Scale your campaigns effortlessly.',
    url: 'https://mail.gpserp.com',
    siteName: 'Mail by GPSERP',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Mail by GPSERP',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mail by GPSERP - AI-Powered Email Outreach',
    description: 'AI-powered email outreach platform for personalized cold emails.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'l8XGPLZkoAaO3sVYk_lZhJDPltoGiqT0kmi9wAxpP68',
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        {/* Google Analytics (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-M5G4S0CYQ3"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-M5G4S0CYQ3');
          `}
        </Script>
        <NextAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <DashboardProvider>
              <DashboardShell>
                {children}
                <Toaster position="bottom-right" richColors />
              </DashboardShell>
            </DashboardProvider>
          </ThemeProvider>
        </NextAuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
