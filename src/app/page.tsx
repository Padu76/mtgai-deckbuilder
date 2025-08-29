// src/app/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const formats = [
    {
      id: 'standard',
      name: 'Standard',
      description: '60 carte, formati recenti, meta veloce',
      icon: '⚡',
      gradient: 'from-blue-600 to-cyan-500',
      features: ['Bo1 & Bo3', 'Sideboard 15 carte', 'Max 4x copie'],
      popular: true
    },
    {
      id: 'brawl',
      name: 'Historic Brawl', 
      description: '100 carte singleton + comandante',
      icon: '👑',
      gradient: 'from-purple-600 to-pink-500',
      features: ['Singleton', 'Identità colore', 'Pool Historic'],
      popular: false
    }
  ]

  const quickActions = [
    {
      title: 'AI Combo Builder',
      description: 'L\'AI trova tutte le combo per i tuoi colori',
      icon: '🧠',
      color: 'bg-purple-600 hover:bg-purple-500',
      href: '/combo-builder'
    },
    {
      title: 'Crea da Archetipi',
      description: 'Scegli uno stile e lascia che l\'AI costruisca',
      icon: '🎯',
      color: 'bg-green-600 hover:bg-green-500',
      href: '/build/standard'
    },
    {
      title: 'Esplora Combo',
      description: 'Database combo infinite e sinergie',
      icon: '💫', 
      color: 'bg-orange-600 hover:bg-orange-500',
      href: '/combos'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <h1 className="text-xl font-bold text-white">MTG Arena Deck Builder</h1>
            </div>
            
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/combo-builder" className="text-gray-300 hover:text-white transition-colors flex items-center space-x-1">
                <span>🧠</span>
                <span>AI Combo</span>
              </Link>
              <Link href="/combos" className="text-gray-300 hover:text-white transition-colors">
                Combo Database
              </Link>
              <Link href="/decks" className="text-gray-300 hover:text-white transition-colors">
                I Miei Deck
              </Link>
              <Link href="/admin" className="text-gray-300 hover:text-white transition-colors">
                Admin
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-orange-600/20 border border-orange-500/30 rounded-full text-orange-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
            Powered by AI - Ottimizzato per MTG Arena
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Costruisci deck
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              competitivi
            </span>
          </h2>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            L'intelligenza artificiale ti aiuta a creare mazzi legali, ottimizzati e pronti per l'import in MTG Arena. 
            Sinergie automatiche, curve bilanciate, export 1-click.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link
              href="/combo-builder"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 hover:shadow-xl flex items-center space-x-2"
            >
              <span>🧠</span>
              <span>Trova Combo con AI</span>
            </Link>
            
            <Link
              href="/build/standard" 
              className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all border border-gray-600 hover:border-gray-500"
            >
              Builder Tradizionale
            </Link>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-white mb-8 text-center">Scegli il formato</h3>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {formats.map((format) => (
              <Link 
                key={format.id}
                href={`/build/${format.id}`}
                onMouseEnter={() => setHoveredCard(format.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className="group relative"
              >
                <div className={`
                  relative overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 p-8
                  transition-all duration-300 hover:scale-105 hover:shadow-2xl
                  ${hoveredCard === format.id ? 'border-gray-500' : ''}
                `}>
                  {/* Gradient overlay */}
                  <div className={`
                    absolute inset-0 bg-gradient-to-br ${format.gradient} opacity-10
                    group-hover:opacity-20 transition-opacity duration-300
                  `} />
                  
                  {/* Popular badge */}
                  {format.popular && (
                    <div className="absolute top-4 right-4 px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-full">
                      POPOLARE
                    </div>
                  )}
                  
                  <div className="relative z-10">
                    <div className="flex items-center mb-4">
                      <span className="text-4xl mr-4">{format.icon}</span>
                      <div>
                        <h4 className="text-2xl font-bold text-white">{format.name}</h4>
                        <p className="text-gray-400">{format.description}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                      {format.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-3"></div>
                          {feature}
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center text-orange-400 font-medium group-hover:text-orange-300 transition-colors">
                      Inizia a costruire
                      <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-white mb-8 text-center">Come vuoi iniziare?</h3>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {quickActions.map((action, idx) => (
              <Link
                key={idx}
                href={action.href}
                className={`
                  ${action.color} p-6 rounded-xl text-white text-left block
                  transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl
                `}
              >
                <div className="text-3xl mb-4">{action.icon}</div>
                <h4 className="font-bold text-lg mb-2">{action.title}</h4>
                <p className="text-white/80 text-sm">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            {
              icon: '🧠',
              title: 'AI Intelligente',
              description: 'Sinergie automatiche e ottimizzazione curve'
            },
            {
              icon: '⚡',
              title: 'Export Arena',
              description: 'Formato testo pronto per l\'import immediato'
            },
            {
              icon: '🎯',
              title: 'Meta Aggiornato',
              description: 'Database carte sempre sincronizzato'
            },
            {
              icon: '🔧',
              title: 'Refine Tools',
              description: 'Modifica rapida con azioni intelligenti'
            }
          ].map((feature, idx) => (
            <div key={idx} className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors">
              <div className="text-2xl mb-3">{feature.icon}</div>
              <h4 className="font-semibold text-white mb-2">{feature.title}</h4>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-8 text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold text-orange-400 mb-1">25,000+</div>
              <div className="text-gray-300 text-sm">Carte Arena</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400 mb-1">500+</div>
              <div className="text-gray-300 text-sm">Combo Catalogate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400 mb-1">95%</div>
              <div className="text-gray-300 text-sm">Precisione Export</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-400 mb-1">24/7</div>
              <div className="text-gray-300 text-sm">Sync Automatica</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              Made with ❤️ for the MTG Arena community
            </div>
            <div className="flex items-center space-x-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms</a>
              <a href="https://github.com" className="text-gray-400 hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}