// src/app/combo-completion/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ComboCard {
  name: string
  mana_cost?: string
  mana_value?: number
  colors?: string[]
  types?: string[]
  oracle_text?: string
  role: 'engine' | 'enabler' | 'payoff' | 'protection' | 'tutor'
}

interface CompletionSuggestion {
  id: string
  suggested_cards: ComboCard[]
  combo_name: string
  description: string
  power_level: number
  consistency_rating: number
  mana_cost_total: number
  setup_difficulty: 'easy' | 'medium' | 'hard'
  explanation: string[]
  steps: string[]
  synergy_score: number
  format_legal: string[]
  archetype: string
  alternate_versions?: {
    cards: ComboCard[]
    description: string
    power_difference: number
  }[]
}

interface CompletionAnalysis {
  input_cards: string[]
  total_suggestions: number
  best_completion: CompletionSuggestion | null
  all_suggestions: CompletionSuggestion[]
  analysis: {
    input_synergy: number
    missing_roles: string[]
    color_requirements: string[]
    mana_curve_needs: string
    format_restrictions: string[]
  }
}

export default function ComboCompletionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [inputCards, setInputCards] = useState<string[]>(['', ''])
  const [results, setResults] = useState<CompletionAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [settings, setSettings] = useState({
    format: 'historic' as 'standard' | 'historic' | 'brawl',
    max_additional_cards: 3,
    power_level_target: 7,
    budget_friendly: false,
    include_tutors: true,
    creative_suggestions: false
  })

  const addCardInput = () => {
    if (inputCards.length < 6) {
      setInputCards([...inputCards, ''])
    }
  }

  const removeCardInput = (index: number) => {
    if (inputCards.length > 2) {
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

  const findCompletions = async () => {
    const validCards = getValidCards()
    
    if (validCards.length < 2) {
      setError('Inserisci almeno 2 carte per trovare completamenti')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/ai/suggest-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_deck: validCards.map(card => ({
            name: card,
            quantity: 1
          })),
          target_cards: validCards.length + settings.max_additional_cards,
          format: settings.format,
          power_level: settings.power_level_target,
          budget_constraints: settings.budget_friendly,
          include_tutors: settings.include_tutors,
          creative_mode: settings.creative_suggestions,
          completion_type: 'combo_focus',
          analysis_goals: [
            'maximize_synergy',
            'optimize_consistency',
            'minimize_setup_cost',
            'ensure_redundancy'
          ]
        })
      })

      const data = await response.json()

      if (data.ok) {
        // Transform API response to our format
        const suggestions: CompletionSuggestion[] = (data.suggested_additions || []).map((addition: any, index: number) => ({
          id: `completion_${index}`,
          suggested_cards: [{
            name: addition.name,
            mana_cost: addition.mana_cost,
            mana_value: addition.mana_value,
            colors: addition.colors,
            types: addition.types,
            oracle_text: addition.oracle_text,
            role: addition.role || 'engine'
          }],
          combo_name: `Combo con ${addition.name}`,
          description: addition.reasoning || `Completa la combo aggiungendo ${addition.name}`,
          power_level: data.analysis?.power_level || settings.power_level_target,
          consistency_rating: data.analysis?.consistency_score || 7,
          mana_cost_total: validCards.length + (addition.mana_value || 0),
          setup_difficulty: 'medium',
          explanation: [addition.reasoning || 'Carta complementare per la combo'],
          steps: [
            `Gioca ${validCards.join(' e ')}`,
            `Aggiungi ${addition.name}`,
            'Attiva la combo'
          ],
          synergy_score: 8,
          format_legal: [settings.format],
          archetype: data.analysis?.archetype || 'combo'
        }))

        // Create comprehensive analysis
        const analysisResult: CompletionAnalysis = {
          input_cards: validCards,
          total_suggestions: suggestions.length,
          best_completion: suggestions[0] || null,
          all_suggestions: suggestions,
          analysis: {
            input_synergy: 7,
            missing_roles: data.analysis?.missing_roles || ['payoff'],
            color_requirements: data.analysis?.color_requirements || [],
            mana_curve_needs: data.analysis?.mana_curve_needs || 'balanced',
            format_restrictions: data.analysis?.format_restrictions || []
          }
        }

        setResults(analysisResult)
      } else {
        setError(data.error || 'Errore durante la ricerca completamenti')
      }
    } catch (err) {
      console.error('Completion error:', err)
      setError('Errore di connessione durante la ricerca')
    } finally {
      setLoading(false)
    }
  }

  const exportCombo = (suggestion: CompletionSuggestion) => {
    const allCards = [...getValidCards(), ...suggestion.suggested_cards.map(c => c.name)]
    const comboText = `# ${suggestion.combo_name}
# Power Level: ${suggestion.power_level}/10
# Consistency: ${suggestion.consistency_rating}/10

## Cards:
${allCards.map(card => `1 ${card}`).join('\n')}

## How it works:
${suggestion.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Description:
${suggestion.description}
`
    
    navigator.clipboard.writeText(comboText)
    alert('Combo copiata negli appunti!')
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-500/20'
      case 'medium': return 'text-yellow-400 bg-yellow-500/20'
      case 'hard': return 'text-red-400 bg-red-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getPowerLevelColor = (power: number) => {
    if (power >= 8) return 'text-red-400'
    if (power >= 6) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getRoleColor = (role: string) => {
    const roleColors = {
      engine: 'bg-purple-500/20 text-purple-400',
      enabler: 'bg-blue-500/20 text-blue-400', 
      payoff: 'bg-red-500/20 text-red-400',
      protection: 'bg-green-500/20 text-green-400',
      tutor: 'bg-yellow-500/20 text-yellow-400'
    }
    return roleColors[role as keyof typeof roleColors] || 'bg-gray-500/20 text-gray-400'
  }

  const exampleCombos = [
    {
      name: 'Infinite Mana',
      cards: ['Basalt Monolith', 'Rings of Brighthearth']
    },
    {
      name: 'Mill Combo',
      cards: ['Painter\'s Servant', 'Grindstone']
    },
    {
      name: 'Token Combo',
      cards: ['Kiki-Jiki, Mirror Breaker', 'Village Bell-Ringer']
    },
    {
      name: 'Storm Setup',
      cards: ['Dark Ritual', 'Cabal Ritual']
    }
  ]

  const loadExample = (example: typeof exampleCombos[0]) => {
    setInputCards([...example.cards, ...Array(Math.max(0, inputCards.length - example.cards.length)).fill('')])
    setError(null)
    setResults(null)
  }

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
            <h1 className="text-3xl font-bold text-white">
              Completamento Combo
            </h1>
          </div>
          <p className="text-gray-300">
            Inserisci 2-4 carte che funzionano insieme. L'AI suggerirà carte per completare combo potenti.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Carte Combo Base ({getValidCards().length}/6)
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
                    {inputCards.length > 2 && (
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
                  disabled={inputCards.length >= 6}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  + Aggiungi Carta
                </button>
                <div className="text-sm text-gray-400">
                  Massimo 6 carte base
                </div>
              </div>

              {/* Examples */}
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-300 mb-2">
                  Esempi combo famose:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {exampleCombos.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => loadExample(example)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs transition-colors text-left"
                    >
                      <div className="font-medium">{example.name}</div>
                      <div className="text-gray-400 text-xs">{example.cards.join(' + ')}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Preferenze</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Formato
                  </label>
                  <select
                    value={settings.format}
                    onChange={(e) => setSettings(prev => ({ 
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
                    Carte Aggiunte: {settings.max_additional_cards}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={settings.max_additional_cards}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      max_additional_cards: parseInt(e.target.value) 
                    }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1</span>
                    <span>5</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Power Target: {settings.power_level_target}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={settings.power_level_target}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      power_level_target: parseInt(e.target.value) 
                    }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Casual</span>
                    <span>cEDH</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.budget_friendly}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      budget_friendly: e.target.checked 
                    }))}
                    className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <span className="text-sm text-gray-300">
                    Priorità carte economiche
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.include_tutors}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      include_tutors: e.target.checked 
                    }))}
                    className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <span className="text-sm text-gray-300">
                    Includi tutor/ricerca
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.creative_suggestions}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      creative_suggestions: e.target.checked 
                    }))}
                    className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <span className="text-sm text-gray-300">
                    Suggerimenti creativi
                  </span>
                </label>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={findCompletions}
              disabled={loading || getValidCards().length < 2}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                loading || getValidCards().length < 2
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105'
              }`}
            >
              {loading ? 'Cercando completamenti...' : 'Trova Completamenti'}
            </button>
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
                  <h3 className="text-lg font-bold text-white mb-4">Analisi Completamenti</h3>
                  <div className="grid grid-cols-2 gap-4 text-center mb-4">
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-400">
                        {results.total_suggestions}
                      </div>
                      <div className="text-sm text-gray-300">Completamenti</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-400">
                        {results.analysis.input_synergy}/10
                      </div>
                      <div className="text-sm text-gray-300">Sinergia Base</div>
                    </div>
                  </div>

                  {results.analysis.missing_roles.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-400 mb-2">Ruoli mancanti:</div>
                      <div className="flex flex-wrap gap-2">
                        {results.analysis.missing_roles.map((role, index) => (
                          <span key={index} className={`px-2 py-1 rounded text-xs ${getRoleColor(role)}`}>
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.analysis.color_requirements.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Requisiti colore:</div>
                      <div className="text-sm text-white">
                        {results.analysis.color_requirements.join(', ')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Completion Suggestions */}
                {results.all_suggestions.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">
                      Completamenti Suggeriti ({results.all_suggestions.length})
                    </h3>
                    
                    {results.all_suggestions.map((suggestion, index) => (
                      <div key={suggestion.id} className="bg-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(suggestion.setup_difficulty)}`}>
                              {suggestion.setup_difficulty.toUpperCase()}
                            </div>
                            <div className={`font-bold ${getPowerLevelColor(suggestion.power_level)}`}>
                              Power {suggestion.power_level}/10
                            </div>
                            <div className="text-sm text-gray-400">
                              Consistency {suggestion.consistency_rating}/10
                            </div>
                          </div>
                          <button
                            onClick={() => exportCombo(suggestion)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
                          >
                            Export
                          </button>
                        </div>

                        <h4 className="font-bold text-white mb-2">{suggestion.combo_name}</h4>
                        <p className="text-gray-300 mb-3">{suggestion.description}</p>

                        <div className="mb-3">
                          <div className="text-sm text-gray-400 mb-1">Carte da aggiungere:</div>
                          <div className="flex flex-wrap gap-2">
                            {suggestion.suggested_cards.map((card, i) => (
                              <div key={i} className="flex items-center space-x-2">
                                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">
                                  {card.name}
                                </span>
                                <span className={`px-1 py-0.5 rounded text-xs ${getRoleColor(card.role)}`}>
                                  {card.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-sm text-gray-400 mb-1">Costo totale: {suggestion.mana_cost_total} mana</div>
                          <div className="text-sm text-gray-400">Archetypo: {suggestion.archetype}</div>
                        </div>

                        <div className="border-t border-gray-700 pt-3">
                          <div className="text-sm text-gray-400 mb-1">Come eseguire:</div>
                          <ol className="text-sm text-gray-300 space-y-1">
                            {suggestion.steps.slice(0, 3).map((step, i) => (
                              <li key={i}>
                                {i + 1}. {step}
                              </li>
                            ))}
                            {suggestion.steps.length > 3 && (
                              <li className="text-gray-500">
                                ... e altri {suggestion.steps.length - 3} passi
                              </li>
                            )}
                          </ol>
                        </div>

                        {suggestion.explanation.length > 0 && (
                          <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Spiegazione:</div>
                            <div className="text-xs text-gray-300">
                              {suggestion.explanation.join(' ')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : results && (
                  <div className="bg-gray-800 rounded-xl p-6 text-center">
                    <div className="text-gray-400 mb-2">Nessun completamento trovato</div>
                    <div className="text-sm text-gray-500">
                      Le carte inserite potrebbero già formare una combo completa o non avere sinergie evidenti
                    </div>
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