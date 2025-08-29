// src/app/deck-optimizer/page.tsx
'use client'

import { useState } from 'react'

interface DeckCard {
  name: string
  quantity: number
  rarity?: string
  mana_cost?: string
  type_line?: string
  is_suggested?: boolean
}

interface OptimizationSuggestion {
  type: 'add' | 'remove' | 'replace'
  card: string
  quantity: number
  reason: string
  priority: 'high' | 'medium' | 'low'
  category: 'mana_curve' | 'synergy' | 'removal' | 'win_condition' | 'consistency'
}

interface DeckAnalysis {
  total_cards: number
  mana_curve: { [key: number]: number }
  color_distribution: { [key: string]: number }
  card_types: { [key: string]: number }
  missing_cards: number
  suggestions: OptimizationSuggestion[]
  power_level: number
  consistency_score: number
}

export default function DeckOptimizerPage() {
  const [deckList, setDeckList] = useState('')
  const [parsedDeck, setParsedDeck] = useState<DeckCard[]>([])
  const [analysis, setAnalysis] = useState<DeckAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parsa la decklist dal testo
  const parseDeckList = (text: string): DeckCard[] => {
    const lines = text.split('\n').filter(line => line.trim())
    const cards: DeckCard[] = []
    
    for (const line of lines) {
      // Supporta formati: "4 Lightning Bolt", "4x Lightning Bolt", "Lightning Bolt x4"
      const matches = line.match(/^(\d+)x?\s+(.+)$/) || line.match(/^(.+)\s+x?(\d+)$/)
      if (matches) {
        const quantity = parseInt(matches[1])
        const name = matches[2].trim()
        
        if (quantity > 0 && name) {
          cards.push({
            name,
            quantity,
            is_suggested: false
          })
        }
      } else if (line.trim()) {
        // Assumere quantità 1 se non specificata
        cards.push({
          name: line.trim(),
          quantity: 1,
          is_suggested: false
        })
      }
    }
    
    return cards
  }

  // Analizza il deck con AI
  const analyzeDeck = async () => {
    if (!deckList.trim()) {
      setError('Inserisci una lista carte per continuare')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const parsed = parseDeckList(deckList)
      setParsedDeck(parsed)

      // Chiama API per analisi AI
      const response = await fetch('/api/ai/analyze-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck_cards: parsed,
          format: 'standard',
          optimization_goals: ['consistency', 'power_level', 'mana_curve']
        })
      })

      const data = await response.json()

      if (data.ok) {
        setAnalysis(data.analysis)
      } else {
        setError(data.error || 'Errore durante l\'analisi del deck')
      }

    } catch (err: any) {
      setError('Errore di connessione: ' + err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Applica suggerimento
  const applySuggestion = (suggestion: OptimizationSuggestion) => {
    let updatedDeck = [...parsedDeck]
    
    switch (suggestion.type) {
      case 'add':
        // Aggiungi carta
        const existingCard = updatedDeck.find(c => c.name === suggestion.card)
        if (existingCard) {
          existingCard.quantity += suggestion.quantity
        } else {
          updatedDeck.push({
            name: suggestion.card,
            quantity: suggestion.quantity,
            is_suggested: true
          })
        }
        break
        
      case 'remove':
        // Rimuovi carta
        updatedDeck = updatedDeck.filter(c => c.name !== suggestion.card)
        break
        
      case 'replace':
        // TODO: implementare logica replace
        break
    }
    
    setParsedDeck(updatedDeck)
    
    // Aggiorna la decklist testuale
    const newDeckList = updatedDeck
      .map(card => `${card.quantity} ${card.name}`)
      .join('\n')
    setDeckList(newDeckList)
  }

  // Esporta per Arena
  const exportForArena = () => {
    const arenaFormat = parsedDeck
      .map(card => `${card.quantity} ${card.name}`)
      .join('\n')
    
    navigator.clipboard.writeText(arenaFormat)
    alert('Lista copiata negli appunti! Incolla in MTG Arena.')
  }

  const totalCards = parsedDeck.reduce((sum, card) => sum + card.quantity, 0)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🛠️ Deck Optimizer
          </h1>
          <p className="text-slate-300 text-lg">
            Carica un deck parziale e l'AI suggerisce le carte mancanti
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📤</span>
              <h2 className="text-xl font-bold text-white">Inserisci Deck List</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <textarea
                  placeholder={`Esempi di formato supportato:
4 Lightning Bolt
3 Counterspell
2x Serra Angel
Shivan Dragon x1

Oppure:
Lightning Bolt
Counterspell
Serra Angel`}
                  value={deckList}
                  onChange={(e) => setDeckList(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-600 text-white rounded-lg p-4 min-h-[300px] font-mono text-sm resize-none focus:border-purple-500 focus:outline-none"
                />
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                  <span>⚠️</span>
                  {error}
                </div>
              )}

              <div>
                <button 
                  onClick={analyzeDeck}
                  disabled={isAnalyzing || !deckList.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="animate-spin">🪄</span>
                      Analizzando...
                    </>
                  ) : (
                    <>
                      <span>🪄</span>
                      Ottimizza Deck
                    </>
                  )}
                </button>
              </div>

              {/* Stats rapide */}
              {parsedDeck.length > 0 && (
                <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Carte totali:</span>
                      <span className={`ml-2 font-bold ${
                        totalCards === 60 ? 'text-green-400' : 
                        totalCards < 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {totalCards}/60
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Tipi unici:</span>
                      <span className="ml-2 text-white font-bold">{parsedDeck.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📊</span>
              <h2 className="text-xl font-bold text-white">Analisi Deck</h2>
            </div>
            
            {!analysis ? (
              <div className="text-center py-12 text-slate-400">
                <span className="text-6xl opacity-50 mb-4 block">🎯</span>
                <p>Inserisci una deck list per vedere l'analisi AI</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Scores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/30 p-4 rounded-lg text-center border border-slate-700/50">
                    <div className="text-2xl font-bold text-blue-400">
                      {analysis.power_level}/10
                    </div>
                    <div className="text-sm text-slate-300">Power Level</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-lg text-center border border-slate-700/50">
                    <div className="text-2xl font-bold text-green-400">
                      {analysis.consistency_score}%
                    </div>
                    <div className="text-sm text-slate-300">Consistenza</div>
                  </div>
                </div>

                <div className="h-px bg-slate-700"></div>

                {/* Suggestions */}
                <div>
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span>⚡</span>
                    Suggerimenti AI ({analysis.suggestions.length})
                  </h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {analysis.suggestions.map((suggestion, index) => (
                      <div key={index} className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(suggestion.priority)}`}>
                              {suggestion.type.toUpperCase()}
                            </span>
                            <span className="text-white font-medium">
                              {suggestion.quantity}x {suggestion.card}
                            </span>
                          </div>
                          <button
                            onClick={() => applySuggestion(suggestion)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <span>✅</span>
                            Applica
                          </button>
                        </div>
                        <p className="text-slate-300 text-sm">
                          {suggestion.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export Section */}
        {parsedDeck.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📥</span>
              <h2 className="text-xl font-bold text-white">Deck Finale</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Deck List */}
              <div className="lg:col-span-2">
                <div className="bg-slate-900/50 p-4 rounded-lg font-mono text-sm max-h-[300px] overflow-y-auto border border-slate-700/50">
                  {parsedDeck.map((card, index) => (
                    <div 
                      key={index} 
                      className={`${card.is_suggested ? 'text-green-400' : 'text-white'} py-1`}
                    >
                      {card.quantity} {card.name}
                      {card.is_suggested && <span className="ml-2 text-xs opacity-75">(suggerita)</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Actions */}
              <div className="space-y-3">
                <button 
                  onClick={exportForArena}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>📥</span>
                  Copia per Arena
                </button>
                
                <div className="text-center text-sm text-slate-400">
                  Totale: {totalCards} carte
                </div>
                
                {totalCards !== 60 && (
                  <div className="text-center text-xs text-yellow-400 flex items-center justify-center gap-1">
                    <span>⚠️</span>
                    Standard richiede esattamente 60 carte
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}