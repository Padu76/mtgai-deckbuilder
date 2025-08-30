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
      description: 'Cerca combo innovative partendo da colori e archetipi. L\'AI trova sinergie che non conoscevi.',
      link: '/combo-builder',
      gradient: 'from-blue-500 to-cyan-400',
      available: true
    },
    {
      id: 'combo-from-cards',
      icon: '🃏',
      title: 'Combo da Carte',
      subtitle: 'Analizza tue carte',
      description: 'Inserisci 2-10 carte che possiedi e scopri tutte le combo possibili con esse.',
      link: '/find-combos-from-cards',
      gradient: 'from-purple-500 to-violet-400',
      available: true
    },
    {
      id: 'combo-completion',
      icon: '🧩',
      title: 'Completa Combo',
      subtitle: 'Suggerisci carte mancanti',
      description: 'Hai una combo parziale? L\'AI suggerisce le carte mancanti per renderla completa e potente.',
      link: '/combo-completion',
      gradient: 'from-orange-500 to-red-400',
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
      id: 'build-from-cards',
      icon: '⚡',
      title: 'Costruisci Deck',
      subtitle: 'Da carte preferite',
      description: 'Parti dalle tue carte preferite e l\'AI costruisce un deck completo attorno ad esse.',
      link: '/build-from-cards',
      gradient: 'from-pink-500 to-rose-400',
      available: true
    },
    {
      id: 'new-sets-analysis',
      icon: '🔥',
      title: 'Combo Nuove',
      subtitle: 'Ultime espansioni',
      description: 'Scopri combo innovative dalle ultime espansioni e come si combinano con carte esistenti.',
      link: '/new-sets-combos',
      gradient: 'from-red-500 to-orange-400',
      available: true
    },
    // Nuove modalità del sistema discovery
    {
      id: 'advanced-combo-discovery',
      icon: '🧬',
      title: 'Discovery Avanzato',
      subtitle: 'AI Pattern Recognition',
      description: 'Sistema avanzato che analizza pattern nascosti nei testi Oracle per scoprire combo mai documentate.',
      link: '/trova-combo',
      gradient: 'from-indigo-500 to-blue-400',
      available: true,
      isNew: true
    },
    {
      id: 'seed-combo-analysis',
      icon: '🔬',
      title: 'Analisi Seed',
      subtitle: 'Reverse Engineering',
      description: 'Inserisci le tue carte e l\'AI fa reverse engineering per trovare tutte le combo possibili.',
      link: '/combo-da-carte',
      gradient: 'from-teal-500 to-cyan-400',
      available: true,
      isNew: true
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute top-4 right-4 z-50">
        <Link href="/admin" className="px-3 py-1 bg-slate-800/50 hover:bg-slate-800/70 text-slate-400 hover:text-white text-sm rounded-lg transition-colors border border-slate-700">
          Admin
        </Link>
      </div>

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
            <div className="flex items-center justify-center gap-3 text-sm mb-8">
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

            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 max-w-md mx-auto">
              <div className="text-sm text-slate-400 mb-3">Quick Start:</div>
              <div className="flex justify-center gap-2">
                <Link href="/combo-builder?colors=U" className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition-colors">
                  🔵 Combo Blu
                </Link>
                <Link href="/find-combos-from-cards" className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-xs hover:bg-purple-500/30 transition-colors">
                  🃏 Dalle mie carte
                </Link>
                <Link href="/trova-combo" className="px-3 py-2 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs hover:bg-indigo-500/30 transition-colors">
                  🧬 Discovery AI
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Tutto quello che serve per dominare Arena
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Scopri nuove strategie, ottimizza i tuoi deck e resta sempre un passo avanti al meta con l'AI più potente del gioco.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

              {feature.id === 'new-sets-analysis' && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs animate-pulse">
                    New!
                  </span>
                </div>
              )}

              {feature.isNew && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs animate-pulse">
                    Advanced AI
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${feature.gradient} text-white text-2xl`}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {feature.subtitle}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-slate-300 leading-relaxed text-sm">
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
                        {feature.isNew ? 'Prova Advanced AI' : 
                         feature.id === 'new-sets-analysis' ? 'Scopri nuove combo' : 'Inizia ora'}
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

              {hoveredFeature === feature.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none rounded-xl" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sezione speciale per il nuovo sistema AI */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-teal-900/30 backdrop-blur-sm border-y border-indigo-800/50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-2xl">🧬</span>
              <h2 className="text-2xl font-bold text-white">Advanced Discovery System</h2>
              <span className="text-2xl">🔬</span>
            </div>
            <p className="text-slate-300 mb-6 max-w-3xl mx-auto">
              Il nostro nuovo motore AI analizza semanticamente i testi Oracle di tutte le carte Arena per trovare 
              combo mai documentate. Non usa database esistenti ma fa pattern recognition avanzato sui testi delle carte.
            </p>
            <div className="flex justify-center gap-4 text-sm mb-6">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
                Pattern Recognition
              </span>
              <span className="px-3 py-1 bg-teal-500/20 text-teal-400 rounded-full border border-teal-500/30">
                Oracle Text Analysis
              </span>
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30">
                Undocumented Combos
              </span>
            </div>
            <div className="flex justify-center gap-4">
              <Link href="/trova-combo">
                <button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all flex items-center gap-2">
                  <span>🔍</span>
                  Scoperta per Archetipi
                </button>
              </Link>
              <Link href="/combo-da-carte">
                <button className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium px-6 py-3 rounded-lg hover:from-teal-700 hover:to-cyan-700 transition-all flex items-center gap-2">
                  <span>🔬</span>
                  Analisi dalle tue Carte
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 backdrop-blur-sm border-y border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Come funziona</h2>
            <p className="text-slate-400">Il tuo workflow ottimizzato per MTG Arena</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-2xl text-white mx-auto mb-4">
                🎯
              </div>
              <h3 className="text-xl font-bold text-white mb-2">1. Scegli il tuo approccio</h3>
              <p className="text-slate-400 text-sm">
                Parti da colori, carte specifiche, deck parziali o dalle ultime espansioni. L'AI si adatta al tuo stile.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-400 rounded-full flex items-center justify-center text-2xl text-white mx-auto mb-4">
                🧠
              </div>
              <h3 className="text-xl font-bold text-white mb-2">2. L'AI analizza</h3>
              <p className="text-slate-400 text-sm">
                Algoritmi avanzati esplorano migliaia di combinazioni per trovare sinergie nascoste e meta-breaking.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full flex items-center justify-center text-2xl text-white mx-auto mb-4">
                🚀
              </div>
              <h3 className="text-xl font-bold text-white mb-2">3. Domina Arena</h3>
              <p className="text-slate-400 text-sm">
                Importa i deck ottimizzati e sorprendi i tuoi avversari con combo innovative dalle ultime carte.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 backdrop-blur-sm border-y border-red-800/50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-2xl">🔥</span>
              <h2 className="text-2xl font-bold text-white">Nuove Espansioni, Nuove Combo</h2>
              <span className="text-2xl">🔥</span>
            </div>
            <p className="text-slate-300 mb-6 max-w-3xl mx-auto">
              L'AI analizza automaticamente le carte delle ultime espansioni e scopre combo mai viste prima. 
              Trova sinergie interne tra nuove carte e combinazioni innovative con il tuo arsenale esistente.
            </p>
            <div className="flex justify-center gap-4 text-sm mb-6">
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                Combo Interne
              </span>
              <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full border border-orange-500/30">
                Cross-Set Synergies
              </span>
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">
                Meta Impact
              </span>
            </div>
            <Link href="/new-sets-combos">
              <button className="bg-gradient-to-r from-red-600 to-orange-600 text-white font-medium px-6 py-3 rounded-lg hover:from-red-700 hover:to-orange-700 transition-all">
                Esplora Combo delle Nuove Espansioni
              </button>
            </Link>
          </div>
        </div>
      </div>

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
            <Link href="/trova-combo">
              <button className="border border-indigo-400 text-indigo-400 font-medium px-8 py-3 rounded-lg hover:bg-indigo-400/10 transition-all flex items-center justify-center gap-2">
                <span>🧬</span>
                Advanced Discovery
              </button>
            </Link>
          </div>

          <div className="mt-6">
            <Link href="/combo-da-carte" className="text-slate-400 hover:text-white transition-colors text-sm">
              O analizza le tue carte con l'Advanced AI →
            </Link>
          </div>
        </div>
      </div>

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