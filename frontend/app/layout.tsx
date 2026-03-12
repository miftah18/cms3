import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'CMS3 POS - Enterprise POS & Business Management',
  description:
    'Multi-tenant enterprise POS and business management platform supporting multiple business types',
  keywords: [
    'POS',
    'Point of Sale',
    'Business Management',
    'Inventory',
    'Multi-tenant',
    'Cloud',
  ],
  authors: [{ name: 'CMS3 Team' }],
  creator: 'CMS3',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://cms3.example.com',
    title: 'CMS3 POS',
    description: 'Enterprise Multi-Tenant POS Platform',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head />
      <body className="bg-background text-foreground antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
