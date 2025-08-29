// src/app/find-combos/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CardPreview from '../../components/CardPreview'

interface Card {
  id: string
  name: string
  mana_cost: string | null
  mana_value: number | null
  colors: string[]
  color_identity: string[]
  types: string[]
  oracle_text: string | null
  rarity: string | null
  set_code: string | null
  image_url: string | null
}

interface ComboMatch {
  id: string
  description: string
  category: string
  cards: Card[]
  synergy_type: 'infinite' | 'engine' | 'protection' | 'acceleration' | 'win_condition'
  power_level: number
  reliability: 'high' | 'medium' | 'low'
  mana_cost_total: number
  explanation: string[]
  keywords_matched: string[]
}

interface SearchResult {
  ok: boolean
  target_card: Card
  combos: ComboMatch[]
  total_combinations_analyzed: number
  format: string
}

export default function FindCombosPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<Card[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [format, setFormat] = useState<'standard' | 'historic' | 'brawl'>('historic')

  // Debounced search for card suggestions
  const searchCards = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}&limit=8`)
      const data = await response.json()
      if (data.ok) {
        setSuggestions(data.cards || [])
      }
    } catch (error) {
      console.error('Error searching cards:', error)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm) {
        searchCards(searchTerm)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, searchCards])

  const handleCardSelect = (card: Card) => {
    setSelectedCard(card)
    setSearchTerm(card.name)
    setShowSuggestions(false)
  }

  const findCombos = async () => {
    if (!selectedCard) return

    setLoading(true)
    try {
      const response = await fetch('/api/ai/find-combos-with-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: selectedCard.id,
          format,
          max_results: 20
        })
      })

      const data = await response.json()
      if (data.ok) {
        setResults(data)
      } else {
        alert('Errore: ' + data.error)
      }
    } catch (error) {
      console.error('Error finding combos:', error)
      alert('Errore durante la ricerca combo')
    } finally {
      setLoading(false)
    }
  }

  const buildDeckFromCombo = async (combo: ComboMatch) => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai/build-combo-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_combos: [combo],
          format,
          colors: combo.cards.flatMap(c => c.color_identity).filter((v, i, a) => a.indexOf(v) === i)
        })
      })

      const data = await response.json()
      if (data.ok) {
        router.push(`/deck/${data.deck_id}`)
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

  const getReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case 'high': return 'text-green-400 bg-green-900/30 border-green-500'
      case 'medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500'
      case 'low': return 'text-red-400 bg-red-900/30 border-red-500'
      default: return 'text-gray-400 bg-gray-800 border-gray-600'
    }
  }

  const getPowerLevelColor = (power: number) => {
    if (power >= 8) return 'text-red-400'
    if (power >= 6) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'infinite_mana': '💎',
      'infinite_tokens': '🧙',
      'infinite_damage': '⚡',
      'sacrifice_engine': '⚱️',
      'proliferate': '📈',
      'mill': '📚',
      'ramp': '🌱',
      'protection': '🛡️',
      'card_advantage': '🎴',
      'flicker': '✨',
      'poison': '☠️',
      'artifact_synergy': '⚙️',
      'enchantment_synergy': '🔮',
      'tribal_synergy': '👥'
    }
    return icons[category] || '💫'
  }

  const groupCombosByCategory = (combos: ComboMatch[]) => {
    const grouped: { [key: string]: ComboMatch[] } = {}
    combos.forEach(combo => {
      const category = combo.category
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(combo)
    })
    return grouped
  }

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
            <h1 className="text-4xl font-bold text-white">
              Trova Combo con Carta
            </h1>
          </div>
          <p className="text-xl text-gray-300">
            Inserisci una carta e scopri tutte le combo possibili
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Formato</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'standard', name: 'Standard', description: '60 carte, meta attuale' },
                  { value: 'historic', name: 'Historic', description: 'Pool esteso, più combo' },
                  { value: 'brawl', name: 'Historic Brawl', description: '100 singleton + comandante' }
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value as any)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      format === f.value
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-bold text-sm">{f.name}</div>
                    <div className="text-xs opacity-80">{f.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Card Search */}
            <div className="relative">
              <h3 className="text-lg font-bold text-white mb-3">Cerca Carta</h3>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowSuggestions(true)
                    if (!e.target.value) setSelectedCard(null)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Scrivi il nome di una carta..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                />

                {/* Selected Card Preview */}
                {selectedCard && (
                  <div className="mt-4 flex items-center space-x-4 p-3 bg-gray-700 rounded-lg">
                    <CardPreview card={selectedCard} size="small" />
                    <div>
                      <h4 className="font-bold text-white">{selectedCard.name}</h4>
                      <p className="text-sm text-gray-300">
                        {selectedCard.types?.join(' ') || ''} • {selectedCard.set_code?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Autocomplete Suggestions */}
                {showSuggestions && suggestions.length > 0 && !selectedCard && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {suggestions.map(card => (
                      <button
                        key={card.id}
                        onClick={() => handleCardSelect(card)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-600 border-b border-gray-600 last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <CardPreview card={card} size="small" />
                          <div>
                            <div className="font-medium text-white">{card.name}</div>
                            <div className="text-sm text-gray-400">
                              {card.types?.join(' ') || ''} • {card.set_code?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={findCombos}
              disabled={!selectedCard || loading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                !selectedCard || loading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-white rounded-full mr-3"></div>
                  Cercando combo...
                </div>
              ) : (
                'Trova Tutte le Combo'
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-8">
            {/* Results Header */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Combo trovate per {results.target_card.name}
                  </h2>
                  <p className="text-gray-300">
                    {results.combos.length} combo trovate analizzando {results.total_combinations_analyzed} carte
                  </p>
                </div>
                <CardPreview card={results.target_card} size="normal" />
              </div>
            </div>

            {/* Combos by Category */}
            {Object.entries(groupCombosByCategory(results.combos)).map(([category, combos]) => (
              <div key={category} className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">{getCategoryIcon(category)}</span>
                  <h3 className="text-xl font-bold text-white">
                    {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                    <span className="text-sm text-gray-400 ml-2">({combos.length} combo)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {combos.map(combo => (
                    <div
                      key={combo.id}
                      className="bg-gray-700 rounded-lg p-4 border-2 border-gray-600 hover:border-gray-500 transition-all"
                    >
                      {/* Combo Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-white mb-1">{combo.description}</h4>
                          <div className="flex items-center space-x-3">
                            <span className={`text-xs px-2 py-1 rounded border ${getReliabilityColor(combo.reliability)}`}>
                              {combo.reliability.toUpperCase()}
                            </span>
                            <span className={`text-sm font-medium ${getPowerLevelColor(combo.power_level)}`}>
                              Power {combo.power_level}/10
                            </span>
                            <span className="text-sm text-gray-400">
                              {combo.mana_cost_total} mana
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cards in Combo */}
                      <div className="mb-4">
                        <div className="text-xs text-gray-400 mb-2">Carte necessarie:</div>
                        <div className="flex space-x-2">
                          {combo.cards.map(card => (
                            <CardPreview
                              key={card.id}
                              card={card}
                              size="small"
                              className="hover:scale-110 transition-transform"
                            />
                          ))}
                        </div>
                      </div>

                      {/* Explanation */}
                      <div className="mb-4">
                        <div className="text-xs text-gray-400 mb-1">Come funziona:</div>
                        <div className="text-xs text-gray-300 space-y-1">
                          {combo.explanation.slice(0, 2).map((step, i) => (
                            <div key={i}>• {step}</div>
                          ))}
                        </div>
                      </div>

                      {/* Keywords */}
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-1">
                          {combo.keywords_matched.slice(0, 4).map(keyword => (
                            <span key={keyword} className="text-xs bg-purple-900/40 text-purple-300 px-2 py-1 rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Build Deck Button */}
                      <button
                        onClick={() => buildDeckFromCombo(combo)}
                        disabled={loading}
                        className="w-full py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:scale-105 transition-all disabled:opacity-50"
                      >
                        Costruisci Deck Completo
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {results.combos.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🤔</div>
                <h3 className="text-xl font-bold text-white mb-2">Nessuna combo trovata</h3>
                <p className="text-gray-300">
                  Prova con una carta diversa o cambia formato
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}