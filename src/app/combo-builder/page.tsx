// src/app/combo-builder/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CardPreview from '@/components/CardPreview'

interface Card {
  id: string
  name: string
  mana_cost: string
  mana_value: number
  colors: string[]
  oracle_text: string
  image_url?: string
  rarity: string
}

interface ComboSuggestion {
  id: string
  cards: Card[]
  category: string
  type: 'infinite' | 'synergy' | 'win_condition' | 'value_engine'
  description: string
  steps: string[]
  reliability: 'high' | 'medium' | 'low'
  setup_turns: number
  mana_cost_total: number
  power_level: number
}

export default function ComboBuilderPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  const [filters, setFilters] = useState({
    colors: [] as string[],
    format: 'historic' as 'standard' | 'historic' | 'brawl',
    categories: [] as string[],
    power_level_min: 5,
    max_setup_turns: 5
  })
  
  const [availableCombos, setAvailableCombos] = useState<ComboSuggestion[]>([])
  const [selectedCombos, setSelectedCombos] = useState<ComboSuggestion[]>([])
  const [categories, setCategories] = useState<any>({})

  const colorOptions = [
    { code: 'W', name: 'Bianco', symbol: '⚪', description: 'Controllo, lifegain, protezione' },
    { code: 'U', name: 'Blu', symbol: '🔵', description: 'Draw, contromagie, mill' },
    { code: 'B', name: 'Nero', symbol: '⚫', description: 'Rimozioni, ricorsione, poison' },
    { code: 'R', name: 'Rosso', symbol: '🔴', description: 'Danno diretto, haste, sacrifice' },
    { code: 'G', name: 'Verde', symbol: '🟢', description: 'Ramp, creature grosse, proliferate' }
  ]

  const comboCategories = [
    { key: 'instant_win', name: 'Vittoria Istantanea', icon: '🏆', description: 'Combo che vincono immediatamente' },
    { key: 'infinite_tokens', name: 'Pedine Infinite', icon: '🧙', description: 'Crea infinite creature' },
    { key: 'infinite_damage', name: 'Danno Infinito', icon: '⚡', description: 'Infligge danno illimitato' },
    { key: 'infinite_mana', name: 'Mana Infinito', icon: '💎', description: 'Genera mana illimitato' },
    { key: 'poison', name: 'Veleno/Toxic', icon: '☠️', description: 'Poison counter e toxic' },
    { key: 'draw_damage', name: 'Danni da Pescaggio', icon: '📚', description: 'Mill + punish' },
    { key: 'lock_stax', name: 'Lock/Controllo', icon: '🔒', description: 'Impedisce azioni avversario' },
    { key: 'value_engine', name: 'Motore Valore', icon: '📈', description: 'Vantaggio carte continuativo' }
  ]

  const toggleColor = (color: string) => {
    setFilters(prev => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter(c => c !== color)
        : [...prev.colors, color].slice(0, 3)
    }))
  }

  const toggleCategory = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }))
  }

  const analyzeCombos = async () => {
    if (filters.colors.length === 0) {
      alert('Seleziona almeno un colore')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ai/analyze-combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colors: filters.colors,
          format: filters.format,
          max_combos: 30
        })
      })

      const data = await response.json()
      if (data.ok) {
        let combos = data.combos || []
        
        // Applica filtri
        if (filters.categories.length > 0) {
          combos = combos.filter((combo: ComboSuggestion) => 
            filters.categories.includes(combo.category)
          )
        }
        
        combos = combos.filter((combo: ComboSuggestion) => 
          combo.power_level >= filters.power_level_min &&
          combo.setup_turns <= filters.max_setup_turns
        )

        setAvailableCombos(combos)
        setCategories(data.categories || {})
        setStep(2)
      } else {
        alert('Errore analisi: ' + data.error)
      }
    } catch (error) {
      console.error('Error analyzing combos:', error)
      alert('Errore durante l\'analisi delle combo')
    } finally {
      setLoading(false)
    }
  }

  const toggleComboSelection = (combo: ComboSuggestion) => {
    setSelectedCombos(prev => {
      const exists = prev.find(c => c.id === combo.id)
      if (exists) {
        return prev.filter(c => c.id !== combo.id)
      } else {
        return [...prev, combo]
      }
    })
  }

  const buildFinalDeck = async () => {
    if (selectedCombos.length === 0) {
      alert('Seleziona almeno una combo')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ai/build-combo-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_combos: selectedCombos,
          format: filters.format,
          colors: filters.colors
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
      case 'high': return 'text-green-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-red-400'
      default: return 'text-gray-400'
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
              AI Combo Builder
            </h1>
          </div>
          
          {/* Progress */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step >= 1 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              1
            </div>
            <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-orange-500' : 'bg-gray-700'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step >= 2 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              2
            </div>
            <div className={`w-16 h-0.5 ${step >= 3 ? 'bg-orange-500' : 'bg-gray-700'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step >= 3 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Step 1: Configurazione */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">
                Configura la tua ricerca
              </h2>
              <p className="text-xl text-gray-300">
                L'AI analizzerà migliaia di carte per trovare le migliori combo
              </p>
            </div>

            {/* Format */}
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Formato</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'standard', name: 'Standard', description: '60 carte, meta attuale' },
                  { value: 'historic', name: 'Historic', description: 'Pool esteso, più combo' },
                  { value: 'brawl', name: 'Historic Brawl', description: '100 singleton + comandante' }
                ].map(format => (
                  <button
                    key={format.value}
                    onClick={() => setFilters(prev => ({ ...prev, format: format.value as any }))}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      filters.format === format.value
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-bold">{format.name}</div>
                    <div className="text-sm opacity-80">{format.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                Colori ({filters.colors.length}/3)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {colorOptions.map(color => (
                  <button
                    key={color.code}
                    onClick={() => toggleColor(color.code)}
                    disabled={!filters.colors.includes(color.code) && filters.colors.length >= 3}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      filters.colors.includes(color.code)
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    } ${
                      !filters.colors.includes(color.code) && filters.colors.length >= 3 
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                    }`}
                  >
                    <div className="text-2xl mb-2">{color.symbol}</div>
                    <div className="font-bold">{color.name}</div>
                    <div className="text-xs opacity-80">{color.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                Tipi di Combo (opzionale)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {comboCategories.map(category => (
                  <button
                    key={category.key}
                    onClick={() => toggleCategory(category.key)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      filters.categories.includes(category.key)
                        ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center mb-1">
                      <span className="mr-2">{category.icon}</span>
                      <span className="font-medium text-sm">{category.name}</span>
                    </div>
                    <div className="text-xs opacity-80">{category.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Filtri Avanzati</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Livello Potenza Minimo: {filters.power_level_min}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={filters.power_level_min}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      power_level_min: parseInt(e.target.value) 
                    }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Casual</span>
                    <span>Competitivo</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Turni Setup: {filters.max_setup_turns}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={filters.max_setup_turns}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      max_setup_turns: parseInt(e.target.value) 
                    }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Veloce</span>
                    <span>Lento</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={analyzeCombos}
                disabled={loading || filters.colors.length === 0}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform ${
                  loading || filters.colors.length === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105 hover:shadow-lg'
                }`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-white rounded-full mr-3"></div>
                    Analizzando...
                  </div>
                ) : (
                  'Trova Combo con AI'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Selezione Combo */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                Seleziona le tue combo preferite
              </h2>
              <p className="text-gray-300">
                Trovate {availableCombos.length} combo per i colori {filters.colors.join(', ')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {availableCombos.map(combo => (
                <div
                  key={combo.id}
                  className={`bg-gray-800 rounded-xl border-2 p-6 cursor-pointer transition-all hover:scale-105 ${
                    selectedCombos.find(c => c.id === combo.id)
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => toggleComboSelection(combo)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">
                        {comboCategories.find(c => c.key === combo.category)?.icon || '💫'}
                      </span>
                      <div className="text-sm">
                        <div className={`font-medium ${getReliabilityColor(combo.reliability)}`}>
                          {combo.reliability.toUpperCase()}
                        </div>
                        <div className={`${getPowerLevelColor(combo.power_level)}`}>
                          Power {combo.power_level}/10
                        </div>
                      </div>
                    </div>
                    {selectedCombos.find(c => c.id === combo.id) && (
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-white mb-2">{combo.description}</h3>
                  
                  <div className="mb-3">
                    <div className="text-sm text-gray-400 mb-1">Carte necessarie:</div>
                    <div className="flex flex-wrap gap-2">
                      {combo.cards.slice(0, 3).map(card => (
                        <CardPreview
                          key={card.id}
                          card={card}
                          size="small"
                          className="hover:scale-110 transition-transform"
                        />
                      ))}
                      {combo.cards.length > 3 && (
                        <div className="w-16 h-22 bg-gray-700 rounded border-2 border-gray-600 flex items-center justify-center text-xs text-gray-400">
                          +{combo.cards.length - 3}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Setup:</span>
                      <span className="text-white">{combo.setup_turns} turni</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Costo totale:</span>
                      <span className="text-white">{combo.mana_cost_total} mana</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Come funziona:</div>
                    <ol className="text-xs text-gray-300 space-y-1">
                      {combo.steps.slice(0, 2).map((step, i) => (
                        <li key={i}>
                          {i + 1}. {step}
                        </li>
                      ))}
                      {combo.steps.length > 2 && (
                        <li className="text-gray-500">... e altri {combo.steps.length - 2} passi</li>
                      )}
                    </ol>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center pt-8">
              <div className="mb-4 text-gray-300">
                {selectedCombos.length} combo selezionate
              </div>
              <button
                onClick={buildFinalDeck}
                disabled={selectedCombos.length === 0 || loading}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
                  selectedCombos.length === 0 || loading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:scale-105'
                }`}
              >
                {loading ? 'Creando deck...' : 'Crea Deck Definitivo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}