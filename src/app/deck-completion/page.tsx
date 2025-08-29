// src/app/deck-completion/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import CardPreview from '../../components/CardPreview'

interface Card {
  id: string
  name: string
  mana_cost?: string
  mana_value?: number
  colors?: string[]
  types?: string[]
  oracle_text?: string
  image_uris?: {
    small?: string
    normal?: string
    large?: string
  } | null
  image_url?: string | null
  rarity?: string
  set_code?: string
  color_identity?: string[]
}

interface DeckCard extends Card {
  quantity: number
  role: string
}

interface DeckAnalysis {
  total_cards: number
  cards_needed: number
  mana_curve: Record<string, number>
  color_distribution: Record<string, number>
  type_distribution: Record<string, number>
  missing_categories: string[]
  weaknesses: string[]
  suggestions: string[]
}

interface CompletionResult {
  ok: boolean
  analysis: DeckAnalysis
  suggested_cards: DeckCard[]
  cards_to_add: number
  completion_strategy: string
}

export default function DeckCompletionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deckId = searchParams.get('deck_id')
  
  const [currentDeck, setCurrentDeck] = useState<{main: DeckCard[], side?: DeckCard[]}>({main: []})
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<CompletionResult | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set<string>())
  const [format, setFormat] = useState<'standard' | 'historic' | 'brawl'>('historic')
  const [targetCards, setTargetCards] = useState(60)

  useEffect(() => {
    if (deckId) {
      loadExistingDeck(deckId)
    }
  }, [deckId])

  const loadExistingDeck = async (id: string) => {
    try {
      const response = await fetch(`/api/deck/${id}`)
      const data = await response.json()
      if (data.ok) {
        setCurrentDeck(data.deck)
        setFormat(data.deck.format || 'historic')
        setTargetCards(data.deck.format === 'brawl' ? 100 : 60)
      }
    } catch (error) {
      console.error('Error loading deck:', error)
    }
  }

  const analyzeDeck = async () => {
    if (currentDeck.main.length === 0) {
      alert('Aggiungi almeno una carta al deck')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ai/suggest-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck: currentDeck,
          target_cards: targetCards,
          format
        })
      })

      const data = await response.json()
      if (data.ok) {
        setAnalysis(data)
        // Seleziona automaticamente tutti i suggerimenti - FIXED TYPE ERROR
        const allSuggestionIds = new Set<string>(data.suggested_cards.map((card: DeckCard) => card.id))
        setSelectedSuggestions(allSuggestionIds)
      } else {
        alert('Errore: ' + data.error)
      }
    } catch (error) {
      console.error('Error analyzing deck:', error)
      alert('Errore durante l\'analisi del deck')
    } finally {
      setLoading(false)
    }
  }

  const toggleSuggestion = (cardId: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set<string>(prev)
      if (newSet.has(cardId)) {
        newSet.delete(cardId)
      } else {
        newSet.add(cardId)
      }
      return newSet
    })
  }

  const getSelectedCards = () => {
    if (!analysis) return []
    return analysis.suggested_cards.filter(card => selectedSuggestions.has(card.id))
  }

  const getFinalDeck = () => {
    const selectedCards = getSelectedCards()
    return {
      main: [...currentDeck.main, ...selectedCards],
      side: currentDeck.side || []
    }
  }

  const saveFinalDeck = async () => {
    const finalDeck = getFinalDeck()
    setLoading(true)
    
    try {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Completed Deck ${new Date().toLocaleDateString()}`,
          format,
          bo_mode: 'bo1',
          main: finalDeck.main,
          side: finalDeck.side
        })
      })

      const data = await response.json()
      if (data.ok) {
        router.push(`/deck/${data.deck_id}`)
      } else {
        alert('Errore nel salvare: ' + data.error)
      }
    } catch (error) {
      console.error('Error saving deck:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    const icons: {[key: string]: string} = {
      'lands': '🏔️',
      'removal': '⚔️',
      'creatures': '🦅',
      'card_draw': '📖',
      'generic': '🎯',
      'artifacts': '⚙️',
      'enchantments': '✨',
      'instants': '⚡',
      'sorceries': '📜'
    }
    return icons[category] || '🎴'
  }

  const groupSuggestionsByCategory = (suggestions: DeckCard[]) => {
    const grouped: {[key: string]: DeckCard[]} = {}
    suggestions.forEach(card => {
      const category = card.role
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(card)
    })
    return grouped
  }

  const getCurrentStats = () => {
    const totalCards = currentDeck.main.reduce((sum, card) => sum + card.quantity, 0)
    const selectedCards = getSelectedCards()
    const selectedCount = selectedCards.reduce((sum, card) => sum + card.quantity, 0)
    
    return {
      current: totalCards,
      selected: selectedCount,
      total: totalCards + selectedCount,
      target: targetCards
    }
  }

  const stats = getCurrentStats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button 
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white mr-4 transition-colors"
            >
              ← Indietro
            </button>
            <h1 className="text-4xl font-bold text-white">
              Deck Completion Assistant
            </h1>
          </div>
          <p className="text-xl text-gray-300">
            L'AI analizza il tuo deck e suggerisce le carte mancanti
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Format */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Formato</h3>
              <div className="space-y-2">
                {[
                  { value: 'standard', name: 'Standard (60)', target: 60 },
                  { value: 'historic', name: 'Historic (60)', target: 60 },
                  { value: 'brawl', name: 'Brawl (100)', target: 100 }
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => {
                      setFormat(f.value as any)
                      setTargetCards(f.target)
                    }}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      format === f.value
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Deck Stats */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Statistiche Attuali</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Carte attuali:</span>
                  <span className="text-white font-medium">{stats.current}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Suggerimenti selezionati:</span>
                  <span className="text-green-400 font-medium">+{stats.selected}</span>
                </div>
                <div className="flex justify-between text-gray-300 border-t border-gray-600 pt-2">
                  <span>Totale finale:</span>
                  <span className="text-white font-bold">{stats.total}/{stats.target}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (stats.total / stats.target) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Azioni</h3>
              <button
                onClick={analyzeDeck}
                disabled={loading || currentDeck.main.length === 0}
                className={`w-full py-4 rounded-xl font-bold transition-all ${
                  loading || currentDeck.main.length === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-white rounded-full mr-2"></div>
                    Analizzando...
                  </div>
                ) : (
                  'Analizza & Suggerisci'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Current Deck Preview */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">
            Deck Attuale ({currentDeck.main.reduce((sum, card) => sum + card.quantity, 0)} carte)
          </h3>
          {currentDeck.main.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {currentDeck.main.map(card => (
                <CardPreview
                  key={card.id}
                  card={card}
                  showQuantity={true}
                  quantity={card.quantity}
                  size="small"
                  className="hover:scale-110 transition-transform"
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📦</div>
              <p>Nessuna carta nel deck. Carica un deck esistente o inizia da zero.</p>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Analysis Overview */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Analisi del Deck</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Mana Curve */}
                <div>
                  <h4 className="font-medium text-gray-300 mb-2">Curva Mana</h4>
                  <div className="space-y-1">
                    {Object.entries(analysis.analysis.mana_curve).map(([cmc, count]) => (
                      <div key={cmc} className="flex justify-between text-sm">
                        <span className="text-gray-400">{cmc}:</span>
                        <span className="text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <h4 className="font-medium text-gray-300 mb-2">Distribuzione Colori</h4>
                  <div className="space-y-1">
                    {Object.entries(analysis.analysis.color_distribution).map(([color, count]) => (
                      <div key={color} className="flex justify-between text-sm">
                        <span className="text-gray-400">{color}:</span>
                        <span className="text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Types */}
                <div>
                  <h4 className="font-medium text-gray-300 mb-2">Tipi di Carta</h4>
                  <div className="space-y-1">
                    {Object.entries(analysis.analysis.type_distribution).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="text-gray-400">{type}:</span>
                        <span className="text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weaknesses */}
                <div>
                  <h4 className="font-medium text-gray-300 mb-2">Punti Deboli</h4>
                  <div className="space-y-1">
                    {analysis.analysis.weaknesses.map((weakness, i) => (
                      <div key={i} className="text-sm text-red-400">
                        • {weakness}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-500">
                <h5 className="font-medium text-blue-300 mb-1">Strategia di Completamento</h5>
                <p className="text-blue-200 text-sm">{analysis.completion_strategy}</p>
              </div>
            </div>

            {/* Suggested Cards */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  Suggerimenti ({analysis.suggested_cards.length} carte)
                </h3>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setSelectedSuggestions(new Set<string>(analysis.suggested_cards.map(c => c.id)))}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                  >
                    Seleziona Tutto
                  </button>
                  <button
                    onClick={() => setSelectedSuggestions(new Set<string>())}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                  >
                    Deseleziona Tutto
                  </button>
                </div>
              </div>

              {Object.entries(groupSuggestionsByCategory(analysis.suggested_cards)).map(([category, cards]) => (
                <div key={category} className="mb-6">
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">{getCategoryIcon(category)}</span>
                    <h4 className="text-lg font-bold text-white">
                      {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      <span className="text-sm text-gray-400 ml-2">({cards.length} carte)</span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {cards.map(card => (
                      <div
                        key={card.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedSuggestions.has(card.id)
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }`}
                        onClick={() => toggleSuggestion(card.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <CardPreview card={card} size="small" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h5 className="font-medium text-white text-sm">{card.name}</h5>
                              {selectedSuggestions.has(card.id) && (
                                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mb-1">
                              {card.mana_cost} • {card.types?.join(' ')}
                            </div>
                            <div className="text-xs text-gray-500">
                              Quantità: {card.quantity}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Final Preview & Save */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  Deck Finale Preview ({stats.total} carte)
                </h3>
                <button
                  onClick={saveFinalDeck}
                  disabled={loading || stats.total === 0}
                  className={`px-6 py-3 rounded-xl font-bold transition-all ${
                    loading || stats.total === 0
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:scale-105'
                  }`}
                >
                  {loading ? 'Salvando...' : 'Salva Deck Completato'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {getFinalDeck().main.map(card => (
                  <CardPreview
                    key={`final-${card.id}`}
                    card={card}
                    showQuantity={true}
                    quantity={card.quantity}
                    size="small"
                    className={selectedSuggestions.has(card.id) ? 'ring-2 ring-green-400' : ''}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}