import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MindShift - AI-Powered Mindset Transformation',
  description: 'A revolutionary AI-powered platform for mindset transformation and personal growth',
  keywords: 'mindset, personal growth, AI, coaching, transformation',
  authors: [{ name: 'MyAiAd' }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'MindShift - AI-Powered Mindset Transformation',
    description: 'Transform your mindset with AI-powered insights and personalized coaching',
    url: 'https://mindshift.vercel.app',
    siteName: 'MindShift',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MindShift - AI-Powered Mindset Transformation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MindShift - AI-Powered Mindset Transformation',
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
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
} 