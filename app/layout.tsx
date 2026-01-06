import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import SkipNavigation from '@/components/layout/SkipNavigation'
import CookieConsent from '@/components/gdpr/CookieConsent'
import { InstallPrompt } from '@/components/mobile/InstallPrompt'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MindShifting - AI-Powered Mindset Transformation',
  description: 'A revolutionary AI-powered platform for mindset transformation and personal growth',
  keywords: 'mindset, personal growth, AI, coaching, transformation',
  authors: [{ name: 'MindShifting' }],
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4f46e5' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MindShifting',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'MindShifting - AI-Powered Mindset Transformation',
    description: 'Transform your mindset with AI-powered insights and personalized coaching',
    url: 'https://myai.vercel.app',
    siteName: 'MindShifting',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MindShifting - AI-Powered Mindset Transformation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MindShifting - AI-Powered Mindset Transformation',
    description: 'Transform your mindset with AI-powered insights and personalized coaching',
    images: ['/og-image.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('darkMode');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const isDark = savedTheme !== null ? savedTheme === 'true' : prefersDark;
                if (isDark) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        {/* Version: 2025-12-31 - Community Tags Fix (Migration 048) */}
        <ThemeProvider>
          <AuthProvider>
            <SkipNavigation />
            <main id="main-content" className="min-h-screen bg-background text-foreground">
              {children}
            </main>
            <CookieConsent />
            <InstallPrompt />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 