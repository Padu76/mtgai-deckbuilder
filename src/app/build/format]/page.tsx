// src/app/build/[format]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface WizardStep {
  id: number
  title: string
  description: string
  completed: boolean
}

export default function BuildWizard() {
  const params = useParams()
  const router = useRouter()
  const format = params.format as 'standard' | 'brawl'
  
  const [currentStep, setCurrentStep] = useState(1)
  const [wizardData, setWizardData] = useState({
    format,
    colors: [] as string[],
    archetype: '',
    commander: null as any,
    budget: 'medium' as 'low' | 'medium' | 'high',
    queue: 'bo1' as 'bo1' | 'bo3',
    seedCards: [] as string[],
    preferences: {
      aggression: 50,
      interaction: 50,
      consistency: 50
    }
  })
  const [isGenerating, setIsGenerating] = useState(false)

  const steps: WizardStep[] = [
    { id: 1, title: 'Stile & Colori', description: 'Scegli come vuoi giocare', completed: false },
    { id: 2, title: format === 'brawl' ? 'Comandante' : 'Archetipi', description: format === 'brawl' ? 'Seleziona il tuo comandante' : 'Stile di gioco preferito', completed: false },
    { id: 3, title: 'Preferenze', description: 'Affina il tuo stile', completed: false },
    { id: 4, title: 'Generazione', description: 'Crea il tuo deck', completed: false }
  ]

  const colorOptions = [
    { code: 'W', name: 'Bianco', symbol: '⚪', description: 'Controllo, protezione, creature piccole efficienti' },
    { code: 'U', name: 'Blu', symbol: '🔵', description: 'Contromagie, card draw, creature volanti' },
    { code: 'B', name: 'Nero', symbol: '⚫', description: 'Rimozioni, ricorsione, sacrifici' },
    { code: 'R', name: 'Rosso', symbol: '🔴', description: 'Danni diretti, creature aggressive, velocità' },
    { code: 'G', name: 'Verde', symbol: '🟢', description: 'Creature grosse, ramp, rigenerazione' },
  ]

  const archetypes = {
    standard: [
      { id: 'aggro', name: 'Aggro', description: 'Veloce e aggressivo, chiude partite in fretta', colors: ['R', 'W'], icon: '⚡' },
      { id: 'midrange', name: 'Midrange', description: 'Bilanciato, minacce e risposte', colors: ['G', 'B', 'R'], icon: '⚖️' },
      { id: 'control', name: 'Control', description: 'Controlla il gioco, finisher potenti', colors: ['U', 'W', 'B'], icon: '🛡️' },
      { id: 'combo', name: 'Combo', description: 'Sinergie specifiche per vittorie esplosive', colors: ['U', 'G', 'B'], icon: '💫' },
      { id: 'tempo', name: 'Tempo', description: 'Pressure costante con backup', colors: ['U', 'R', 'W'], icon: '🌊' }
    ],
    brawl: [
      { id: 'value', name: 'Value Engine', description: 'Vantaggio carte a lungo termine', icon: '📈' },
      { id: 'tribal', name: 'Tribal', description: 'Sinergie di tribù specifiche', icon: '🏴' },
      { id: 'goodstuff', name: 'Goodstuff', description: 'Carte potenti senza tema specifico', icon: '💎' },
      { id: 'voltron', name: 'Voltron', description: 'Potenzia una minaccia singola', icon: '🗡️' },
      { id: 'stax', name: 'Stax/Control', description: 'Rallenta gli avversari', icon: '⛓️' }
    ]
  }

  const budgetOptions = [
    { value: 'low', name: 'Budget', description: 'Poche rare/mythic', wildcards: '< 20', color: 'text-green-400' },
    { value: 'medium', name: 'Medio', description: 'Bilanciato', wildcards: '20-40', color: 'text-yellow-400' },
    { value: 'high', name: 'Premium', description: 'Ottimizzato', wildcards: '40+', color: 'text-red-400' }
  ]

  const toggleColor = (color: string) => {
    setWizardData(prev => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter(c => c !== color)
        : [...prev.colors, color].slice(0, 3) // Max 3 colori
    }))
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const endpoint = format === 'standard' ? '/api/build/standard' : '/api/build/brawl'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizardData)
      })
      const result = await response.json()
      
      if (result.ok) {
        // Redirect to deck editor with generated deck
        router.push(`/deck/${result.deck_id}`)
      }
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const canProceed = (step: number) => {
    switch (step) {
      case 1: return wizardData.colors.length > 0
      case 2: return format === 'brawl' ? wizardData.commander : wizardData.archetype
      case 3: return true
      case 4: return true
      default: return false
    }
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
            <h1 className="text-2xl font-bold text-white">
              Crea deck {format === 'standard' ? 'Standard' : 'Historic Brawl'}
            </h1>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center space-x-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                  ${currentStep > step.id 
                    ? 'bg-green-500 text-white' 
                    : currentStep === step.id 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-700 text-gray-400'
                  }
                `}>
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="ml-2 hidden md:block">
                  <div className="text-sm font-medium text-white">{step.title}</div>
                  <div className="text-xs text-gray-400">{step.description}</div>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-gray-800 rounded-2xl p-8 min-h-[500px]">
          {currentStep === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Che colori vuoi giocare?</h2>
                <p className="text-gray-400">Seleziona fino a 3 colori per il tuo deck</p>
              </div>
              
              {/* Queue Selection (Standard only) */}
              {format === 'standard' && (
                <div className="text-center">
                  <h3 className="text-lg font-medium text-white mb-4">Modalità di gioco</h3>
                  <div className="flex justify-center space-x-4">
                    {[
                      { value: 'bo1', name: 'Best of 1', description: 'Partite singole, meta più vario' },
                      { value: 'bo3', name: 'Best of 3', description: 'Con sideboard, più competitivo' }
                    ].map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => setWizardData(prev => ({ ...prev, queue: mode.value as any }))}
                        className={`
                          p-4 rounded-xl border-2 transition-all min-w-[180px]
                          ${wizardData.queue === mode.value
                            ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                            : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                          }
                        `}
                      >
                        <div className="font-medium">{mode.name}</div>
                        <div className="text-sm opacity-80">{mode.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Color Selection */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {colorOptions.map(color => (
                  <button
                    key={color.code}
                    onClick={() => toggleColor(color.code)}
                    disabled={!wizardData.colors.includes(color.code) && wizardData.colors.length >= 3}
                    className={`
                      p-6 rounded-xl border-2 text-center transition-all transform hover:scale-105
                      ${wizardData.colors.includes(color.code)
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                      }
                      ${!wizardData.colors.includes(color.code) && wizardData.colors.length >= 3 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg'
                      }
                    `}
                  >
                    <div className="text-4xl mb-2">{color.symbol}</div>
                    <div className="font-bold text-lg mb-1">{color.name}</div>
                    <div className="text-xs opacity-80 leading-tight">{color.description}</div>
                  </button>
                ))}
              </div>
              
              <div className="text-center text-sm text-gray-400">
                Colori selezionati: {wizardData.colors.length}/3
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {format === 'brawl' ? 'Scegli il tuo comandante' : 'Che stile preferisci?'}
                </h2>
                <p className="text-gray-400">
                  {format === 'brawl' 
                    ? 'Il comandante definisce identità colore e strategia' 
                    : 'Ogni archetipo ha un approccio diverso alla vittoria'
                  }
                </p>
              </div>

              {format === 'standard' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {archetypes.standard.map(archetype => (
                    <button
                      key={archetype.id}
                      onClick={() => setWizardData(prev => ({ ...prev, archetype: archetype.id }))}
                      className={`
                        p-6 rounded-xl border-2 text-left transition-all transform hover:scale-105
                        ${wizardData.archetype === archetype.id
                          ? 'border-orange-500 bg-orange-500/20'
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }
                      `}
                    >
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">{archetype.icon}</span>
                        <div>
                          <div className="font-bold text-white">{archetype.name}</div>
                          <div className="flex space-x-1">
                            {archetype.colors.map(c => (
                              <span key={c} className="text-xs">
                                {colorOptions.find(co => co.code === c)?.symbol}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm">{archetype.description}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <div className="bg-gray-700 rounded-xl p-8 mb-6">
                    <div className="text-6xl mb-4">🔄</div>
                    <h3 className="text-xl font-medium text-white mb-2">Cerca comandanti compatibili</h3>
                    <p className="text-gray-400 mb-4">
                      Colori selezionati: {wizardData.colors.map(c => 
                        colorOptions.find(co => co.code === c)?.symbol
                      ).join(' ')}
                    </p>
                    <button className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-lg transition-colors">
                      Trova comandanti
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Affina le tue preferenze</h2>
                <p className="text-gray-400">Personalizza lo stile di gioco del tuo deck</p>
              </div>

              {/* Budget Selection */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Budget Wildcards</h3>
                <div className="grid grid-cols-3 gap-4">
                  {budgetOptions.map(budget => (
                    <button
                      key={budget.value}
                      onClick={() => setWizardData(prev => ({ ...prev, budget: budget.value as any }))}
                      className={`
                        p-4 rounded-xl border-2 text-center transition-all
                        ${wizardData.budget === budget.value
                          ? 'border-orange-500 bg-orange-500/20'
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }
                      `}
                    >
                      <div className={`font-bold ${budget.color}`}>{budget.wildcards}</div>
                      <div className="text-white font-medium">{budget.name}</div>
                      <div className="text-sm text-gray-400">{budget.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Sliders */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-white">Bilanciamento strategia</h3>
                
                {[
                  { key: 'aggression', label: 'Aggressività', low: 'Defensivo', high: 'Aggressivo' },
                  { key: 'interaction', label: 'Interazione', low: 'Poche rimozioni', high: 'Molte rimozioni' },
                  { key: 'consistency', label: 'Consistenza', low: 'Toolbox vario', high: 'Copie multiple' }
                ].map(slider => (
                  <div key={slider.key}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">{slider.label}</span>
                      <span className="text-orange-400">{wizardData.preferences[slider.key as keyof typeof wizardData.preferences]}%</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={wizardData.preferences[slider.key as keyof typeof wizardData.preferences]}
                        onChange={(e) => setWizardData(prev => ({
                          ...prev,
                          preferences: {
                            ...prev.preferences,
                            [slider.key]: parseInt(e.target.value)
                          }
                        }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{slider.low}</span>
                        <span>{slider.high}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="text-center space-y-8">
              <h2 className="text-3xl font-bold text-white mb-2">Pronto per generare!</h2>
              <p className="text-gray-400">Rivedi le tue scelte e genera il deck</p>

              {/* Summary */}
              <div className="bg-gray-700 rounded-xl p-6 text-left max-w-md mx-auto">
                <h3 className="font-bold text-white mb-4">Riepilogo:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Formato:</span>
                    <span className="text-white">{format.charAt(0).toUpperCase() + format.slice(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Colori:</span>
                    <div className="text-white">
                      {wizardData.colors.map(c => 
                        colorOptions.find(co => co.code === c)?.symbol
                      ).join(' ')}
                    </div>
                  </div>
                  {format === 'standard' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Modalità:</span>
                        <span className="text-white">{wizardData.queue.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Archetipo:</span>
                        <span className="text-white">
                          {archetypes.standard.find(a => a.id === wizardData.archetype)?.name}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Budget:</span>
                    <span className="text-white">
                      {budgetOptions.find(b => b.value === wizardData.budget)?.name}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`
                  px-8 py-4 rounded-xl font-bold text-lg transition-all transform
                  ${isGenerating
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105 hover:shadow-lg'
                  }
                `}
              >
                {isGenerating ? (
                  <div className="flex items-center">
                    <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-white rounded-full mr-3"></div>
                    Generando deck...
                  </div>
                ) : (
                  'Genera il mio deck!'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Indietro
          </button>
          
          <button
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            disabled={currentStep === 4 || !canProceed(currentStep)}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {currentStep === 4 ? 'Genera' : 'Avanti'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ea580c;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ea580c;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}