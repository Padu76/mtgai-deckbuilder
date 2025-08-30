'use client'
// src/app/combo-da-carte/page.tsx
// Interfaccia per scoprire combo dalle carte dell'utente

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface Card {
  id: string
  name: string
  name_it?: string
  mana_value: number
  mana_cost: string
  colors: string[]
  types: string[]
  oracle_text: string
  image_url?: string
}

interface ComboResult {
  type: string
  cards: string[]
  steps: string[]
  requirements: string[]
  power_level: number
  consistency: number
  mana_cost: number
  colors_required: string[]
}

interface DiscoveryResults {
  combos: ComboResult[]
  combos_by_type: Record<string, ComboResult[]>
  synergies: any[]
  explanations: string[]
  stats: {
    total_analyzed: number
    filtered_results: number
    returned_results: number
    analysis_time_ms: number
    combo_types_found: string[]
    avg_power_level: string
    avg_mana_cost: string
  }
  suggestions: string[]
}

export default function ComboDaCartePage() {
  const [cards, setCards] = useState<Card[]>([])
  const [selectedCards, setSelectedCards] = useState<Card[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [format, setFormat] = useState<'standard' | 'historic' | 'brawl'>('standard')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<DiscoveryResults | null>(null)
  const [error, setError] = useState('')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })

  useEffect(() => {
    loadCards()
  }, [format])

  async function loadCards() {
    const { data, error } = await supabase
      .from('cards')
      .select('id, name, name_it, mana_value, mana_cost, colors, types, oracle_text, image_url')
      .eq('in_arena', true)
      .eq(format === 'standard' ? 'legal_standard' : format === 'historic' ? 'legal_historic' : 'legal_brawl', true)
      .order('name')
      .limit(1000)

    if (error) {
      setError(`Errore caricamento carte: ${error.message}`)
      return
    }

    setCards(data || [])
  }

  const filteredCards = cards.filter(card => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (card.name.toLowerCase().includes(query) || 
            card.name_it?.toLowerCase().includes(query) ||
            card.oracle_text.toLowerCase().includes(query) ||
            card.types.some(type => type.toLowerCase().includes(query)))
  })

  function addCard(card: Card) {
    if (selectedCards.length >= 10) {
      setError('Massimo 10 carte per ricerca')
      return
    }
    if (selectedCards.find(c => c.id === card.id)) return
    setSelectedCards([...selectedCards, card])
    setError('')
  }

  function removeCard(cardId: string) {
    setSelectedCards(selectedCards.filter(c => c.id !== cardId))
  }

  async function discoverCombos() {
    if (selectedCards.length < 2) {
      setError('Seleziona almeno 2 carte per trovare combo')
      return
    }

    setIsLoading(true)
    setError('')
    setResults(null)

    try {
      const response = await fetch('/api/discover/combo-from-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed_card_ids: selectedCards.map(c => c.id),
          format,
          max_combos: 15,
          min_power_level: 5
        })
      })

      const data = await response.json()

      if (!data.ok) {
        setError(data.error || 'Errore nella ricerca combo')
        return
      }

      setResults(data)
    } catch (err: any) {
      setError(err.message || 'Errore di connessione')
    } finally {
      setIsLoading(false)
    }
  }

  function getCardById(cardId: string): Card | undefined {
    return selectedCards.find(c => c.id === cardId)
  }

  function getComboTypeIcon(type: string): string {
    switch (type) {
      case 'infinite_mana': return '♾️⚡'
      case 'infinite_damage': return '♾️💀'
      case 'infinite_cards': return '♾️📚'
      case 'infinite_life': return '♾️❤️'
      case 'value_engine': return '⚙️'
      case 'lock': return '🔒'
      case 'synergy': return '🔗'
      default: return '✨'
    }
  }

  function getComboTypeName(type: string): string {
    switch (type) {
      case 'infinite_mana': return 'Mana Infinito'
      case 'infinite_damage': return 'Danni Infiniti'
      case 'infinite_cards': return 'Carte Infinite'
      case 'infinite_life': return 'Vita Infinita'
      case 'value_engine': return 'Motore di Valore'
      case 'lock': return 'Lock/Controllo'
      case 'synergy': return 'Sinergia'
      default: return type
    }
  }

  function getPowerLevelColor(level: number): string {
    if (level >= 9) return 'text-red-400'
    if (level >= 7) return 'text-orange-400'
    if (level >= 5) return 'text-yellow-400'
    return 'text-gray-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto p-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🧬 Combo da Carte</h1>
          <p className="text-lg text-gray-300">Scopri combo innovative dalle tue carte preferite</p>
        </header>

        {/* Formato e Controlli */}
        <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              {(['standard', 'historic', 'brawl'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    format === fmt 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                </button>
              ))}
            </div>
            
            <div className="text-sm text-gray-400">
              Carte caricate: {cards.length} | Selezionate: {selectedCards.length}/10
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selezione Carte */}
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Cerca e Aggiungi Carte</h2>
              
              <input
                type="text"
                placeholder="Cerca per nome, tipo o testo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 bg-slate-900 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
              />
              
              <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                {filteredCards.slice(0, 50).map(card => (
                  <div
                    key={card.id}
                    onClick={() => addCard(card)}
                    className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-medium">{card.name_it || card.name}</div>
                      <div className="text-sm text-gray-400">
                        {card.mana_cost} • {card.types.join(' ')}
                      </div>
                    </div>
                    <div className="text-2xl">+</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carte Selezionate */}
            <div className="bg-slate-800/50 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Carte Selezionate</h2>
              
              {selectedCards.length === 0 ? (
                <p className="text-gray-400">Seleziona 2-10 carte per iniziare</p>
              ) : (
                <div className="space-y-2">
                  {selectedCards.map(card => (
                    <div
                      key={card.id}
                      className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{card.name_it || card.name}</div>
                        <div className="text-sm text-gray-400">{card.mana_cost}</div>
                      </div>
                      <button
                        onClick={() => removeCard(card.id)}
                        className="text-red-400 hover:text-red-300 text-xl"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={discoverCombos}
                disabled={selectedCards.length < 2 || isLoading}
                className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                {isLoading ? '🔍 Analizzando...' : '✨ Scopri Combo'}
              </button>
            </div>
          </div>

          {/* Risultati */}
          <div className="space-y-4">
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-xl p-4">
                <p className="text-red-300">{error}</p>
              </div>
            )}

            {results && (
              <>
                {/* Statistiche */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h2 className="text-xl font-semibold mb-4">Risultati Analisi</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Combo Trovate</div>
                      <div className="text-2xl font-bold text-green-400">{results.stats.returned_results}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Potenza Media</div>
                      <div className="text-2xl font-bold text-yellow-400">{results.stats.avg_power_level}/10</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Costo Medio</div>
                      <div className="text-xl font-bold text-blue-400">{results.stats.avg_mana_cost} mana</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Tempo Analisi</div>
                      <div className="text-xl font-bold text-purple-400">{results.stats.analysis_time_ms}ms</div>
                    </div>
                  </div>
                </div>

                {/* Suggerimenti */}
                {results.suggestions.length > 0 && (
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4">
                    <h3 className="font-semibold mb-2">💡 Suggerimenti</h3>
                    <ul className="space-y-1 text-sm">
                      {results.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-blue-200">• {suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Combo Trovate */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h2 className="text-xl font-semibold mb-4">Combo Scoperte</h2>
                  
                  {results.combos.length === 0 ? (
                    <p className="text-gray-400">Nessuna combo trovata con questi parametri. Prova carte con meccaniche più complementari.</p>
                  ) : (
                    <div className="space-y-4">
                      {results.combos.map((combo, i) => (
                        <div key={i} className="bg-slate-900/50 rounded-lg p-4 border-l-4 border-purple-500">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getComboTypeIcon(combo.type)}</span>
                              <h3 className="font-semibold">{getComboTypeName(combo.type)}</h3>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className={`font-bold ${getPowerLevelColor(combo.power_level)}`}>
                                {combo.power_level}/10
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-400">{combo.mana_cost} mana</span>
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="text-sm text-gray-400 mb-1">Carte coinvolte:</div>
                            <div className="flex flex-wrap gap-2">
                              {combo.cards.map(cardId => {
                                const card = getCardById(cardId)
                                return card ? (
                                  <span key={cardId} className="px-2 py-1 bg-purple-800/30 rounded text-sm">
                                    {card.name_it || card.name}
                                  </span>
                                ) : null
                              })}
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="text-sm text-gray-400 mb-1">Come funziona:</div>
                            <ol className="text-sm space-y-1">
                              {combo.steps.map((step, j) => (
                                <li key={j} className="text-gray-200">{step}</li>
                              ))}
                            </ol>
                          </div>

                          {combo.requirements.length > 0 && (
                            <div>
                              <div className="text-sm text-gray-400 mb-1">Requisiti:</div>
                              <ul className="text-sm space-y-1">
                                {combo.requirements.map((req, j) => (
                                  <li key={j} className="text-yellow-200">• {req}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center text-xs text-gray-400">
                            <span>Consistenza: {combo.consistency}/10</span>
                            <span>Colori: {combo.colors_required.join('')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sinergie Aggiuntive */}
                {results.explanations.length > 0 && (
                  <div className="bg-slate-800/50 rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4">Sinergie Identificate</h2>
                    <ul className="space-y-2">
                      {results.explanations.map((exp, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-400 mt-1">•</span>
                          <span className="text-gray-200">{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}