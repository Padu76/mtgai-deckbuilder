'use client'
// src/app/trova-combo/page.tsx
// Interfaccia per scoprire combo innovative da colori e archetipi

import { useState } from 'react'

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
  stats: {
    total_analyzed: number
    returned_results: number
    analysis_time_ms: number
    avg_power_level: string
    avg_mana_cost: string
  }
  suggestions: string[]
}

export default function TrovaComboPage() {
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedArchetype, setSelectedArchetype] = useState('')
  const [format, setFormat] = useState<'standard' | 'historic' | 'brawl'>('standard')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<DiscoveryResults | null>(null)
  const [error, setError] = useState('')

  const colors = [
    { code: 'W', name: 'Bianco', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { code: 'U', name: 'Blu', class: 'bg-blue-100 text-blue-800 border-blue-300' },
    { code: 'B', name: 'Nero', class: 'bg-gray-100 text-gray-800 border-gray-300' },
    { code: 'R', name: 'Rosso', class: 'bg-red-100 text-red-800 border-red-300' },
    { code: 'G', name: 'Verde', class: 'bg-green-100 text-green-800 border-green-300' }
  ]

  const archetypes = [
    'Lifegain', 'Artifacts', 'Spells', 'Tokens', 'Sacrifice', 'Graveyard',
    'Counters', 'Enchantments', 'Tribal', 'Ramp', 'Control', 'Aggro'
  ]

  function toggleColor(colorCode: string) {
    setSelectedColors(prev => 
      prev.includes(colorCode) 
        ? prev.filter(c => c !== colorCode)
        : [...prev, colorCode]
    )
  }

  async function discoverCombos() {
    if (selectedColors.length === 0 && !selectedArchetype) {
      setError('Seleziona almeno un colore o archetipo')
      return
    }

    setIsLoading(true)
    setError('')
    setResults(null)

    try {
      const response = await fetch('/api/discover/combo-by-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colors: selectedColors,
          archetype: selectedArchetype.toLowerCase(),
          format,
          max_combos: 20
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

  function getComboTypeIcon(type: string): string {
    switch (type) {
      case 'infinite_mana': return '⚡'
      case 'infinite_damage': return '💀'
      case 'infinite_cards': return '📚'
      case 'infinite_life': return '❤️'
      case 'value_engine': return '⚙️'
      case 'lock': return '🔒'
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
      default: return 'Sinergia'
    }
  }

  function getPowerLevelColor(level: number): string {
    if (level >= 9) return 'text-red-400'
    if (level >= 7) return 'text-orange-400'
    if (level >= 5) return 'text-yellow-400'
    return 'text-gray-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white">
      <div className="container mx-auto p-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🔍 Trova Combo</h1>
          <p className="text-lg text-gray-300">Scopri sinergie nascoste da colori e archetipi</p>
        </header>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Selezione Formato */}
          <div className="bg-slate-800/50 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Formato</h2>
            <div className="flex gap-2">
              {(['standard', 'historic', 'brawl'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    format === fmt 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Selezione Colori */}
          <div className="bg-slate-800/50 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Colori (opzionale)</h2>
            <div className="flex flex-wrap gap-3">
              {colors.map(color => (
                <button
                  key={color.code}
                  onClick={() => toggleColor(color.code)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                    selectedColors.includes(color.code)
                      ? color.class + ' transform scale-105'
                      : 'bg-slate-700 text-gray-300 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  {color.code} {color.name}
                </button>
              ))}
            </div>
            {selectedColors.length > 0 && (
              <div className="mt-3 text-sm text-gray-400">
                Colori selezionati: {selectedColors.join('')}
              </div>
            )}
          </div>

          {/* Selezione Archetipo */}
          <div className="bg-slate-800/50 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Archetipo (opzionale)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {archetypes.map(archetype => (
                <button
                  key={archetype}
                  onClick={() => setSelectedArchetype(selectedArchetype === archetype ? '' : archetype)}
                  className={`p-3 rounded-lg transition-all font-medium ${
                    selectedArchetype === archetype
                      ? 'bg-purple-600 text-white transform scale-105'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {archetype}
                </button>
              ))}
            </div>
            {selectedArchetype && (
              <div className="mt-3 text-sm text-gray-400">
                Archetipo selezionato: {selectedArchetype}
              </div>
            )}
          </div>

          {/* Pulsante Ricerca */}
          <div className="text-center">
            <button
              onClick={discoverCombos}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
            >
              {isLoading ? '🔍 Ricerca in corso...' : '✨ Scopri Combo Innovative'}
            </button>
          </div>

          {/* Errori */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-xl p-4">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Risultati */}
          {results && (
            <div className="space-y-6">
              {/* Statistiche */}
              <div className="bg-slate-800/50 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4">Risultati Analisi</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-400">{results.stats.returned_results}</div>
                    <div className="text-sm text-gray-400">Combo Trovate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">{results.stats.avg_power_level}/10</div>
                    <div className="text-sm text-gray-400">Potenza Media</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">{results.stats.avg_mana_cost}</div>
                    <div className="text-sm text-gray-400">Costo Medio</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-400">{results.stats.analysis_time_ms}ms</div>
                    <div className="text-sm text-gray-400">Tempo Analisi</div>
                  </div>
                </div>
              </div>

              {/* Suggerimenti */}
              {results.suggestions && results.suggestions.length > 0 && (
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-6">
                  <h3 className="font-semibold mb-3">💡 Suggerimenti per Ottimizzare</h3>
                  <ul className="space-y-2">
                    {results.suggestions.map((suggestion, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span className="text-blue-200">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Combo Trovate */}
              <div className="bg-slate-800/50 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4">Combo Innovative Scoperte</h2>
                
                {results.combos.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🤔</div>
                    <p className="text-gray-400">Nessuna combo innovativa trovata con questi parametri.</p>
                    <p className="text-sm text-gray-500 mt-2">Prova combinazioni di colori diverse o archetipi meno esplorati.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {results.combos.map((combo, i) => (
                      <div key={i} className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 rounded-lg p-5 border-l-4 border-blue-500">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{getComboTypeIcon(combo.type)}</span>
                            <div>
                              <h3 className="font-semibold text-lg">{getComboTypeName(combo.type)}</h3>
                              <div className="text-sm text-gray-400">Combo #{i + 1}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <div className={`text-xl font-bold ${getPowerLevelColor(combo.power_level)}`}>
                                {combo.power_level}/10
                              </div>
                              <div className="text-xs text-gray-400">Potenza</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-blue-400">{combo.mana_cost}</div>
                              <div className="text-xs text-gray-400">Mana</div>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="text-sm text-gray-400 mb-2">Carte coinvolte:</div>
                          <div className="flex flex-wrap gap-2">
                            {combo.cards.map((cardId, j) => (
                              <span key={j} className="px-3 py-1 bg-blue-800/30 rounded-full text-sm border border-blue-600/30">
                                Carta {j + 1}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="text-sm text-gray-400 mb-2">Come funziona:</div>
                          <ol className="space-y-1">
                            {combo.steps.map((step, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                                  {j + 1}
                                </span>
                                <span className="text-gray-200">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {combo.requirements && combo.requirements.length > 0 && (
                          <div className="mb-4">
                            <div className="text-sm text-gray-400 mb-2">Requisiti:</div>
                            <ul className="space-y-1">
                              {combo.requirements.map((req, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <span className="text-yellow-400 mt-1">⚠</span>
                                  <span className="text-yellow-200 text-sm">{req}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-700 flex justify-between items-center text-sm text-gray-400">
                          <span>Consistenza: {combo.consistency}/10</span>
                          <span>Colori richiesti: {combo.colors_required.join('') || 'Incolore'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}