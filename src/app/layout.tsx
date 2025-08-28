import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MTG Arena AI Deck Builder',
  description: 'Deck builder AI-guided per MTG Arena',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <div className="mx-auto max-w-5xl p-4">
          <header className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">MTG Arena AI Deck Builder</h1>
            <nav className="text-sm opacity-80">
              <a href="/build/standard" className="mr-4 hover:underline">Standard</a>
              <a href="/build/brawl" className="mr-4 hover:underline">Historic Brawl</a>
              <a href="/admin" className="hover:underline">Admin</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
