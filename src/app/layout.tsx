// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { DeckWorkspaceProvider } from '../components/DeckWorkspaceContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MTG Arena AI Deck Builder',
  description: 'Costruisci deck competitivi per MTG Arena con intelligenza artificiale',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#ea580c',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png'
  },
  manifest: '/manifest.json'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MTG AI Builder" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#ea580c" />
      </head>
      <body className={`${inter.className} bg-gray-900 text-white antialiased`}>
        <DeckWorkspaceProvider>
          <div id="root">
            {children}
          </div>
          
          {/* Toast notifications container */}
          <div id="toast-container" className="fixed top-4 right-4 z-50 space-y-2"></div>
          
          {/* Loading overlay */}
          <div id="loading-overlay" className="fixed inset-0 bg-black bg-opacity-50 z-50 hidden items-center justify-center">
            <div className="bg-gray-800 rounded-lg p-6 flex items-center space-x-4">
              <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-orange-500 rounded-full"></div>
              <div className="text-white font-medium">Caricamento...</div>
            </div>
          </div>
        </DeckWorkspaceProvider>
      </body>
    </html>
  )
}