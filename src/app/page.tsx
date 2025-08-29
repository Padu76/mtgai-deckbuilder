// src/app/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Wand2, 
  Zap, 
  TrendingUp, 
  Users, 
  Trophy,
  Sparkles,
  Target,
  Wrench
} from 'lucide-react'

export default function HomePage() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null)

  const features = [
    {
      id: 'combo-discovery',
      icon: <Search className="w-8 h-8" />,
      title: 'Trova Combo',
      subtitle: 'Scopri sinergie nascoste',
      description: 'Cerca combo innovative partendo da una o più carte. L\'AI trova sinergie che non conoscevi.',
      link: '/combo-builder',
      color: 'from-blue-500 to-cyan-400',
      bgColor: 'bg-blue-500/10 hover:bg-blue-500/20'
    },
    {
      id: 'deck-optimizer', 
      icon: <Wrench className="w-8 h-8" />,
      title: 'Completa Deck',
      subtitle: 'Ottimizza esistente',
      description: 'Carica un deck parziale e l\'AI suggerisce le carte mancanti per renderlo competitivo.',
      link: '/deck-optimizer',
      color: 'from-green-500 to-emerald-400',
      bgColor: 'bg-green-500/10 hover:bg-green-500/20'
    },
    {
      id: 'meta-analysis',
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Analisi Meta',
      subtitle: 'Studia tendenze',
      description: 'Analizza il metagame corrente e scopri quali combo dominano la scena competitiva.',
      link: '/meta-analysis',
      color: 'from-purple-500 to-pink-400',
      bgColor: 'bg-purple-500/10 hover:bg-purple-500/20',
      comingSoon: true
    },
    {
      id: 'collection-sync',
      icon: <Target className="w-8 h-8" />,
      title: 'Collezione Arena',
      subtitle: 'Sincronizza account',
      description: 'Collega il tuo account MTG Arena per vedere solo combo realizzabili con le tue carte.',
      link: '/collection-sync',
      color: 'from-orange-500 to-red-400',
      bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
      comingSoon: true
    }
  ]

  const stats = [
    { label: 'Combo Scoperte', value: '12,847+', icon: <Zap className="w-5 h-5" /> },
    { label: 'Utenti Attivi', value: '2,341', icon: <Users className="w-5 h-5" /> },
    { label: 'Deck Ottimizzati', value: '5,629', icon: <Trophy className="w-5 h-5" /> }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-20">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-purple-400 mr-3" />
              <h1 className="text-5xl font-bold text-white">
                MTG Arena AI
              </h1>
              <Sparkles className="w-8 h-8 text-purple-400 ml-3" />
            </div>
            <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto">
              L'intelligenza artificiale più avanzata per scoprire combo nascoste e ottimizzare i tuoi deck su Magic Arena
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <Badge variant="outline" className="border-purple-400 text-purple-400">
                Standard
              </Badge>
              <Badge variant="outline" className="border-blue-400 text-blue-400">
                Historic
              </Badge>
              <Badge variant="outline" className="border-green-400 text-green-400">
                Brawl
              </Badge>
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
                  {stat.icon}
                  <span className="text-3xl font-bold text-white ml-2">
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
            <Card 
              key={feature.id}
              className={`relative bg-slate-800/50 border-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${feature.bgColor} group cursor-pointer`}
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              {feature.comingSoon && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500">
                    Coming Soon
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${feature.color} text-white`}>
                    {feature.icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-white group-hover:to-slate-300">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {feature.subtitle}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
                
                <div className="pt-2">
                  {feature.comingSoon ? (
                    <Button 
                      disabled 
                      className="w-full bg-slate-700 text-slate-400 cursor-not-allowed"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Prossimamente
                    </Button>
                  ) : (
                    <Link href={feature.link} className="block">
                      <Button className={`w-full bg-gradient-to-r ${feature.color} text-white hover:shadow-lg transition-all duration-300 transform hover:scale-105`}>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Inizia ora
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>

              {/* Hover Effect Overlay */}
              {hoveredFeature === feature.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
              )}
            </Card>
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
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 px-8 py-3">
                <Search className="w-5 h-5 mr-2" />
                Scopri Combo Ora
              </Button>
            </Link>
            <Link href="/deck-optimizer">
              <Button size="lg" variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400/10 px-8 py-3">
                <Wrench className="w-5 h-5 mr-2" />
                Ottimizza Deck
              </Button>
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
              <Badge variant="outline" className="border-green-500 text-green-400">
                🟢 Servizi Online
              </Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}