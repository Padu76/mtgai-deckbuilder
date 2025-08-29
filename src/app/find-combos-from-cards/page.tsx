// src/app/find-combos-from-cards/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Card {
  id: string
  name: string
  mana_cost?: string
  mana_value?: number
  colors?: string[]
  types?: string[]
  oracle_text?: string
  rarity?: string
}

interface ComboResult {
  id: string
  cards: string[]
  description: string
  steps: string[]
  power_level: number
  reliability: 'high' | 'medium' | 'low'
  category: string
  missing_cards?: string[]
  synergy_score: number
  explanation: string
}

interface SuggestionResult {
  suggested_cards: string[]
  reasoning: string
  potential_combos: number
  power_increase: number
}

export default function FindCombosFromCardsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [inputCards, setInputCards] = useState<string[]>([''])
  const [results, setResults] = useState<{
    combos: ComboResult[]
    suggestions: SuggestionResult | null
    analysis: any
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    format: 'historic' as 'standard' | 'historic' | 'brawl',
    min_power_level: 3,
    max_missing_cards: 2,
    include_partial_combos: true
  })

  const addCardInput = () => {
    if (inputCards.length < 10) {
      setInputCards([...inputCards, ''])
    }
  }

  const removeCardInput = (index: number) => {
    if (inputCards.length > 1) {
      setInputCards(inputCards.filter((_, i) => i !== index))
    }
  }

  const updateCardInput = (index: number, value: string) => {
    const newCards = [...inputCards]
    newCards[index] = value
    setInputCards(newCards)
  }

  const getValidCards = () => {
    return inputCards.filter(card => card.trim().length > 0)
  }

  const findCombos = async () => {
    const validCards = getValidCards()
    
    if (validCards.length < 2) {
      setError('Inserisci almeno 2 nomi di carte')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/ai/find-combos-with-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: validCards,
          format: filters.format,
          min_power_level: filters.min_power_level,
          max_missing_cards: filters.max_missing_cards,
          include_partial: filters.include_partial_combos,
          analyze_synergies: true
        })
      })

      const data = await response.json()

      if (data.ok) {
        setResults({
          combos: data.combos || [],
          suggestions: data.suggestions || null,
          analysis: data.synergy_analysis || {}
        })
      } else {
        setError(data.error || 'Errore durante la ricerca combo')
      }
    } catch (err) {
      console.error('Find combos error:', err)
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const exportResults = () => {
    if (!results) return

    const exportData = {
      input_cards: getValidCards(),
      timestamp: new Date().toISOString(),
      combos_found: results.combos.length,
      combos: results.combos,
      suggestions: results.suggestions,
      filters: filters
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `combo-analysis-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case 'high': return 'text-green-400 bg-green-500/20'
      case 'medium': return 'text-yellow-400 bg-yellow-500/20'
      case 'low': return 'text-red-400 bg-red-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getPowerLevelColor = (power: number) => {
    if (power >= 8) return 'text-red-400'
    if (power >= 6) return 'text-yellow-400'
    return 'text-green-400'
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
            <h1 className="text-3xl font-bold text-white">
              Trova Combo da Carte Specifiche
            </h1>
          </div>
          <p className="text-gray-300">
            Inserisci le carte che hai o vuoi usare. L'AI troverà tutte le combo possibili e suggerirà carte per completarle.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Inserisci Carte ({getValidCards().length}/10)
              </h2>
              
              <div className="space-y-3">
                {inputCards.map((card, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={card}
                      onChange={(e) => updateCardInput(index, e.target.value)}
                      placeholder={`Carta ${index + 1} (es. Lightning Bolt)`}
                      className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                    />
                    {inputCards.length > 1 && (
                      <button
                        onClick={() => removeCardInput(index)}
                        className="p-3 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-4">
                <button
                  onClick={addCardInput}
                  disabled={inputCards.length >= 10}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  + Aggiungi Carta
                </button>
                <div className="text-sm text-gray-400">
                  Massimo 10 carte
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Filtri</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Formato
                  </label>
                  <select
                    value={filters.format}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      format: e.target.value as any 
                    }))}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="standard">Standard</option>
                    <option value="historic">Historic</option>
                    <option value="brawl">Historic Brawl</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Potenza Minima: {filters.min_power_level}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={filters.min_power_level}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      min_power_level: parseInt(e.target.value) 
                    }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Carte Mancanti: {filters.max_missing_cards}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={filters.max_missing_cards}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      max_missing_cards: parseInt(e.target.value) 
                    }))}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include_partial"
                    checked={filters.include_partial_combos}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      include_partial_combos: e.target.checked 
                    }))}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <label htmlFor="include_partial" className="ml-2 text-sm text-gray-300">
                    Includi combo parziali (carte mancanti)
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={findCombos}
                disabled={loading || getValidCards().length < 2}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  loading || getValidCards().length < 2
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:scale-105'
                }`}
              >
                {loading ? 'Analizzando...' : 'Trova Combo'}
              </button>

              {results && (
                <button
                  onClick={exportResults}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  Esporta Risultati
                </button>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-xl p-4">
                <div className="text-red-400 font-medium">{error}</div>
              </div>
            )}

            {results && (
              <>
                {/* Summary */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Analisi Risultati</h3>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="text-2xl font-bold text-purple-400">
                        {results.combos.length}
                      </div>
                      <div className="text-sm text-gray-300">Combo Trovate</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-400">
                        {results.suggestions?.suggested_cards?.length || 0}
                      </div>
                      <div className="text-sm text-gray-300">Carte Suggerite</div>
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                {results.suggestions && (
                  <div className="bg-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">
                      Suggerimenti per Migliorare
                    </h3>
                    <div className="mb-3">
                      <div className="text-sm text-gray-300 mb-2">Carte consigliate:</div>
                      <div className="flex flex-wrap gap-2">
                        {results.suggestions.suggested_cards.map((card, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                            {card}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {results.suggestions.reasoning}
                    </div>
                    <div className="mt-2 text-xs text-green-400">
                      +{results.suggestions.power_increase} power level stimato
                    </div>
                  </div>
                )}

                {/* Combo Results */}
                {results.combos.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">
                      Combo Disponibili ({results.combos.length})
                    </h3>
                    
                    {results.combos.map((combo, index) => (
                      <div key={combo.id} className="bg-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`px-2 py-1 rounded text-xs font-medium ${getReliabilityColor(combo.reliability)}`}>
                              {combo.reliability.toUpperCase()}
                            </div>
                            <div className={`font-bold ${getPowerLevelColor(combo.power_level)}`}>
                              Power {combo.power_level}/10
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">
                            Sinergia {combo.synergy_score}/10
                          </div>
                        </div>

                        <h4 className="font-bold text-white mb-2">{combo.description}</h4>

                        <div className="mb-3">
                          <div className="text-sm text-gray-400 mb-1">Carte necessarie:</div>
                          <div className="flex flex-wrap gap-2">
                            {combo.cards.map((card, i) => {
                              const isInputCard = getValidCards().some(input => 
                                input.toLowerCase().includes(card.toLowerCase()) || 
                                card.toLowerCase().includes(input.toLowerCase())
                              )
                              return (
                                <span 
                                  key={i} 
                                  className={`px-2 py-1 rounded text-xs ${
                                    isInputCard 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : 'bg-gray-600 text-gray-300'
                                  }`}
                                >
                                  {card}
                                </span>
                              )
                            })}
                          </div>
                        </div>

                        {combo.missing_cards && combo.missing_cards.length > 0 && (
                          <div className="mb-3">
                            <div className="text-sm text-yellow-400 mb-1">
                              Carte mancanti ({combo.missing_cards.length}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {combo.missing_cards.map((card, i) => (
                                <span key={i} className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                                  {card}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-gray-700 pt-3">
                          <div className="text-sm text-gray-400 mb-1">Come funziona:</div>
                          <ol className="text-sm text-gray-300 space-y-1">
                            {combo.steps.slice(0, 3).map((step, i) => (
                              <li key={i}>
                                {i + 1}. {step}
                              </li>
                            ))}
                            {combo.steps.length > 3 && (
                              <li className="text-gray-500">
                                ... e altri {combo.steps.length - 3} passi
                              </li>
                            )}
                          </ol>
                        </div>

                        {combo.explanation && (
                          <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Spiegazione dettagliata:</div>
                            <div className="text-xs text-gray-300">{combo.explanation}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : results ? (
                  <div className="bg-gray-800 rounded-xl p-6 text-center">
                    <div className="text-gray-400 mb-2">Nessuna combo trovata</div>
                    <div className="text-sm text-gray-500">
                      Prova ad aggiungere più carte o ridurre i filtri
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}