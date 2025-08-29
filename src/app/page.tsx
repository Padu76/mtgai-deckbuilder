// src/app/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null)

  const features = [
    {
      id: 'combo-discovery',
      icon: '🔍',
      title: 'Trova Combo',
      subtitle: 'Scopri sinergie nascoste',
      description: 'Cerca combo innovative partendo da una o più carte. L\'AI trova sinergie che non conoscevi.',
      link: '/combo-builder',
      gradient: 'from-blue-500 to-cyan-400',
      available: true
    },
    {
      id: 'deck-optimizer', 
      icon: '🛠️',
      title: 'Completa Deck',
      subtitle: 'Ottimizza esistente',
      description: 'Carica un deck parziale e l\'AI suggerisce le carte mancanti per renderlo competitivo.',
      link: '/deck-optimizer',
      gradient: 'from-green-500 to-emerald-400',
      available: true
    },
    {
      id: 'meta-analysis',
      icon: '📊',
      title: 'Analisi Meta',
      subtitle: 'Studia tendenze',
      description: 'Analizza il metagame corrente e scopri quali combo dominano la scena competitiva.',
      link: '/meta-analysis',
      gradient: 'from-purple-500 to-pink-400',
      available: false
    },
    {
      id: 'collection-sync',
      icon: '🎯',
      title: 'Collezione Arena',
      subtitle: 'Sincronizza account',
      description: 'Collega il tuo account MTG Arena per vedere solo combo realizzabili con le tue carte.',
      link: '/collection-sync',
      gradient: 'from-orange-500 to-red-400',
      available: false
    }
  ]

  const stats = [
    { label: 'Combo Scoperte', value: '12,847+', icon: '⚡' },
    { label: 'Utenti Attivi', value: '2,341', icon: '👥' },
    { label: 'Deck Ottimizzati', value: '5,629', icon: '🏆' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-20">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <span className="text-4xl mr-3">✨</span>
              <h1 className="text-5xl font-bold text-white">
                MTG Arena AI
              </h1>
              <span className="text-4xl ml-3">✨</span>
            </div>
            <p className="text-xl text-slate-300 mb-6 max-w-2xl mx-auto">
              L'intelligenza artificiale più avanzata per scoprire combo nascoste e ottimizzare i tuoi deck su Magic Arena
            </p>
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full border border-purple-400/30">
                Standard
              </span>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-400/30">
                Historic
              </span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-400/30">
                Brawl
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-y border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-2xl mr-2">{stat.icon}</span>
                  <span className="text-3xl font-bold text-white">
                    {stat.value}
                  </span>
                </div>
                <p className="text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Features Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Tutto quello che serve per dominare Arena
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Scopri nuove strategie, ottimizza i tuoi deck e resta sempre un passo avanti al meta con l'AI più potente del gioco.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div 
              key={feature.id}
              className={`
                relative bg-slate-800/50 border border-slate-700 rounded-xl p-6
                transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer
                ${feature.available ? 'hover:bg-slate-800/70' : 'opacity-75'}
              `}
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              {!feature.available && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full text-xs">
                    Coming Soon
                  </span>
                </div>
              )}
              
              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${feature.gradient} text-white text-2xl`}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-white group-hover:to-slate-300">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {feature.subtitle}
                  </p>
                </div>
              </div>
              
              {/* Content */}
              <div className="space-y-4">
                <p className="text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
                
                <div className="pt-2">
                  {feature.available ? (
                    <Link href={feature.link} className="block">
                      <button className={`
                        w-full bg-gradient-to-r ${feature.gradient} text-white font-medium py-3 px-4 rounded-lg
                        hover:shadow-lg transition-all duration-300 transform hover:scale-105
                        flex items-center justify-center gap-2
                      `}>
                        <span>🪄</span>
                        Inizia ora
                      </button>
                    </Link>
                  ) : (
                    <button 
                      disabled 
                      className="w-full bg-slate-700 text-slate-400 font-medium py-3 px-4 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span>🪄</span>
                      Prossimamente
                    </button>
                  )}
                </div>
              </div>

              {/* Hover Effect */}
              {hoveredFeature === feature.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none rounded-xl" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Pronto a rivoluzionare il tuo gioco?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Migliaia di giocatori stanno già usando l'AI per dominare su MTG Arena. 
            Unisciti a loro e scopri combo che cambieranno per sempre il tuo approccio al gioco.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/combo-builder">
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium px-8 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2">
                <span>🔍</span>
                Scopri Combo Ora
              </button>
            </Link>
            <Link href="/deck-optimizer">
              <button className="border border-purple-400 text-purple-400 font-medium px-8 py-3 rounded-lg hover:bg-purple-400/10 transition-all flex items-center justify-center gap-2">
                <span>🛠️</span>
                Ottimizza Deck
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-slate-400 mb-4 md:mb-0">
              <p>© 2025 MTG Arena AI. Creato con ❤️ per la community Magic.</p>
              <p className="text-sm text-slate-500 mt-1">
                Non affiliato con Wizards of the Coast. Magic: The Gathering è un marchio di Wizards of the Coast LLC.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                Servizi Online
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}