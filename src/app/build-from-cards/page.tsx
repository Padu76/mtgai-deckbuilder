// src/app/build-from-cards/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CardPreview from '../components/CardPreview'

interface Card {
  id: string
  name: string
  mana_cost?: string
  mana_value?: number
  colors?: string[]
  color_identity?: string[]
  types?: string[]
  oracle_text?: string
  set_code?: string
  rarity?: string
  image_url?: string
}

interface SeedCard {
  card: Card
  quantity: number
}

interface BuildStrategy {
  strategy_type: 'combo' | 'aggro' | 'control' | 'ramp' | 'tribal' | 'artifacts' | 'enchantments' | 'value_engine'
  focus_areas: string[]
  mana_curve_preference: 'low' | 'mid' | 'high' | 'balanced'
  interaction_level: 'minimal' | 'moderate' | 'heavy'
}

export default function DeckBuilderFromCards() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  const [seedCards, setSeedCards] = useState<SeedCard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  
  const [strategy, setStrategy] = useState<BuildStrategy>({
    strategy_type: 'combo',
    focus_areas: ['synergy'],
    mana_curve_preference: 'balanced',
    interaction_level: 'moderate'
  })
  
  const [format, setFormat] = useState<'standard' | 'brawl'>('standard')
  const [targetCards] = useState(60)

  const strategies = [
    { 
      id: 'combo' as const, 
      name: 'Combo', 
      icon: '🔄', 
      description: 'Focus su sinergie specifiche per vittorie esplosive',
      focus_areas: ['synergy', 'consistency', 'protection']
    },
    { 
      id: 'aggro' as const, 
      name: 'Aggro', 
      icon: '⚡', 
      description: 'Pressione immediata con creature veloci',
      focus_areas: ['speed', 'efficiency', 'reach']
    },
    { 
      id: 'control' as const, 
      name: 'Control', 
      icon: '🛡️', 
      description: 'Controllo del gioco con rimozioni e contromagie',
      focus_areas: ['removal', 'card_advantage', 'late_game']
    },
    { 
      id: 'ramp' as const, 
      name: 'Ramp', 
      icon: '🌱', 
      description: 'Accelerazione mana per minacce grosse',
      focus_areas: ['acceleration', 'big_spells', 'land_ramp']
    },
    { 
      id: 'tribal' as const, 
      name: 'Tribal', 
      icon: '👥', 
      description: 'Sinergie di tribù specifiche',
      focus_areas: ['tribal_synergy', 'lords', 'creature_types']
    },
    { 
      id: 'artifacts' as const, 
      name: 'Artifacts', 
      icon: '⚙️', 
      description: 'Engine basata su artefatti',
      focus_areas: ['artifacts', 'metalcraft', 'synergy']
    },
    { 
      id: 'enchantments' as const, 
      name: 'Enchantments', 
      icon: '✨', 
      description: 'Sinergie incantesimi e aure',
      focus_areas: ['enchantments', 'constellation', 'permanents']
    },
    { 
      id: 'value_engine' as const, 
      name: 'Value Engine', 
      icon: '📈', 
      description: 'Vantaggio carte e engine a lungo termine',
      focus_areas: ['card_advantage', 'recursion', 'engines']
    }
  ]

  const searchCards = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const response = await fetch('/api/cards/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query.trim(),
          limit: 20,
          format 
        })
      })

      const data = await response.json()
      if (data.ok) {
        setSearchResults(data.cards || [])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchCards(searchQuery)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const addSeedCard = (card: Card) => {
    const existing = seedCards.find(s => s.card.id === card.id)
    if (existing) {
      const maxQuantity = format === 'brawl' ? 1 : 4
      if (existing.quantity < maxQuantity) {
        setSeedCards(prev => prev.map(s => 
          s.card.id === card.id 
            ? { ...s, quantity: s.quantity + 1 }
            : s
        ))
      }
    } else {
      setSeedCards(prev => [...prev, { card, quantity: 1 }])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const removeSeedCard = (cardId: string) => {
    setSeedCards(prev => prev.filter(s => s.card.id !== cardId))
  }

  const updateSeedQuantity = (cardId: string, quantity: number) => {
    if (quantity <= 0) {
      removeSeedCard(cardId)
    } else {
      const maxQuantity = format === 'brawl' ? 1 : 4
      setSeedCards(prev => prev.map(s =>
        s.card.id === cardId 
          ? { ...s, quantity: Math.min(quantity, maxQuantity) }
          : s
      ))
    }
  }

  const buildDeck = async () => {
    if (seedCards.length === 0) {
      alert('Aggiungi almeno una carta')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ai/build-deck-from-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed_cards: seedCards,
          strategy,
          format,
          target_cards: targetCards
        })
      })

      const data = await response.json()
      if (data.ok) {
        // Create a deck and redirect to editor
        router.push(`/deck/from-cards-${Date.now()}?data=${encodeURIComponent(JSON.stringify(data))}`)
      } else {
        alert('Errore creazione deck: ' + data.error)
      }
    } catch (error) {
      console.error('Error building deck:', error)
      alert('Errore durante la creazione del deck')
    } finally {
      setLoading(false)
    }
  }

  const selectedStrategy = strategies.find(s => s.id === strategy.strategy_type)
  const totalSeedCards = seedCards.reduce((sum, seed) => sum + seed.quantity, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button 
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white mr-4 transition-colors"
            >
              ← Indietro
            </button>
            <h1 className="text-3xl font-bold text-white">
              Deck Builder da Carte
            </h1>
          </div>
          
          <p className="text-gray-300 text-lg">
            Inserisci le tue carte preferite e l'AI creerà un deck completo attorno ad esse
          </p>
        </div>

        {/* Step 1: Format Selection */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Seleziona Formato</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: 'standard', name: 'Standard', description: '60 carte, 4x copie' },
                  { value: 'brawl', name: 'Historic Brawl', description: '100 singleton + comandante' }
                ].map(fmt => (
                  <button
                    key={fmt.value}
                    onClick={() => setFormat(fmt.value as any)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      format === fmt.value
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-bold">{fmt.name}</div>
                    <div className="text-sm opacity-80">{fmt.description}</div>
                  </button>
                ))}
              </div>
              
              <div className="mt-6 text-center">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Continua
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Add Seed Cards */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                Aggiungi Carte ({totalSeedCards}/20)
              </h3>
              
              {/* Search */}
              <div className="relative mb-6">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca carte per nome..."
                  className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
                />
                
                {searching && (
                  <div className="absolute right-3 top-3 w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mb-6 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {searchResults.map(card => (
                      <button
                        key={card.id}
                        onClick={() => addSeedCard(card)}
                        className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-left"
                        disabled={seedCards.length >= 20}
                      >
                        <div className="w-12 h-16 bg-gray-600 rounded flex-shrink-0 flex items-center justify-center text-xs text-gray-400">
                          {card.mana_cost || 'N/A'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{card.name}</div>
                          <div className="text-sm text-gray-400">{card.types?.join(' ')}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Cards */}
              <div className="mb-6">
                <h4 className="font-medium text-white mb-3">Carte Selezionate</h4>
                {seedCards.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    Nessuna carta selezionata. Cerca e aggiungi le tue carte preferite.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {seedCards.map(seed => (
                      <div key={seed.card.id} className="flex items-center space-x-3 bg-gray-700 p-3 rounded-lg">
                        <CardPreview 
                          card={seed.card} 
                          size="small"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{seed.card.name}</div>
                          <div className="text-sm text-gray-400">{seed.card.mana_cost}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateSeedQuantity(seed.card.id, seed.quantity - 1)}
                            className="w-6 h-6 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                          >
                            −
                          </button>
                          <span className="text-white font-medium w-8 text-center">{seed.quantity}</span>
                          <button
                            onClick={() => updateSeedQuantity(seed.card.id, seed.quantity + 1)}
                            className="w-6 h-6 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                            disabled={seed.quantity >= (format === 'brawl' ? 1 : 4)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Indietro
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={seedCards.length === 0}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continua
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Strategy Selection */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Scegli Strategia</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {strategies.map(strat => (
                  <button
                    key={strat.id}
                    onClick={() => setStrategy(prev => ({ 
                      ...prev, 
                      strategy_type: strat.id,
                      focus_areas: strat.focus_areas
                    }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      strategy.strategy_type === strat.id
                        ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-2xl mb-2">{strat.icon}</div>
                    <div className="font-bold mb-1">{strat.name}</div>
                    <div className="text-xs opacity-80">{strat.description}</div>
                  </button>
                ))}
              </div>

              {/* Advanced Options */}
              <div className="bg-gray-700 rounded-xl p-4 mb-6">
                <h4 className="font-medium text-white mb-3">Opzioni Avanzate</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Curva Mana</label>
                    <select
                      value={strategy.mana_curve_preference}
                      onChange={(e) => setStrategy(prev => ({ 
                        ...prev, 
                        mana_curve_preference: e.target.value as any 
                      }))}
                      className="w-full bg-gray-600 text-white p-2 rounded border border-gray-500 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="low">Bassa (1-3 mana)</option>
                      <option value="balanced">Bilanciata</option>
                      <option value="mid">Media (3-5 mana)</option>
                      <option value="high">Alta (5+ mana)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Livello Interazione</label>
                    <select
                      value={strategy.interaction_level}
                      onChange={(e) => setStrategy(prev => ({ 
                        ...prev, 
                        interaction_level: e.target.value as any 
                      }))}
                      className="w-full bg-gray-600 text-white p-2 rounded border border-gray-500 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="minimal">Minimale</option>
                      <option value="moderate">Moderata</option>
                      <option value="heavy">Pesante</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Indietro
                </button>
                <button
                  onClick={buildDeck}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creando deck...' : 'Crea Deck con AI'}
                </button>
              </div>
            </div>

            {/* Preview */}
            {selectedStrategy && seedCards.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Anteprima</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-white mb-2">Strategia: {selectedStrategy.name}</h4>
                    <p className="text-gray-300 text-sm">{selectedStrategy.description}</p>
                    <div className="mt-2">
                      <div className="text-xs text-gray-400">Focus: {strategy.focus_areas.join(', ')}</div>
                      <div className="text-xs text-gray-400">Curva: {strategy.mana_curve_preference}</div>
                      <div className="text-xs text-gray-400">Interazione: {strategy.interaction_level}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-2">Carte Base ({totalSeedCards})</h4>
                    <div className="text-sm text-gray-300">
                      L'AI completerà il deck fino a {targetCards} carte aggiungendo:
                    </div>
                    <ul className="text-xs text-gray-400 mt-1 space-y-1">
                      <li>• Terre appropriate per i colori</li>
                      <li>• Carte di supporto per la strategia</li>
                      <li>• Interazione e rimozioni</li>
                      <li>• Engine di valore aggiuntive</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}