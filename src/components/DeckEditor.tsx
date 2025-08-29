// src/components/DeckEditor.tsx
'use client'
import { useState, useMemo } from 'react'
import CardPreview from './CardPreview'
import CardLibrary from './CardLibrary'

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
  collector_number?: string
  rarity?: string
  image_uris?: any
  image_url?: string
}

interface DeckCard extends Card {
  quantity: number
  role: 'main' | 'side' | 'commander'
}

interface DeckData {
  format: 'standard' | 'brawl'
  bo_mode: 'bo1' | 'bo3'
  commander?: DeckCard
  main: DeckCard[]
  side: DeckCard[]
  name?: string
}

interface DeckEditorProps {
  initialDeck: DeckData
  onDeckChange?: (deck: DeckData) => void
}

export default function DeckEditor({ initialDeck, onDeckChange }: DeckEditorProps) {
  const [deck, setDeck] = useState<DeckData>(initialDeck)
  const [activeTab, setActiveTab] = useState<'deck' | 'library'>('deck')
  const [showExportModal, setShowExportModal] = useState(false)

  // Stats del mazzo
  const deckStats = useMemo(() => {
    const mainCount = deck.main.reduce((sum, card) => sum + card.quantity, 0)
    const sideCount = deck.side.reduce((sum, card) => sum + card.quantity, 0)
    const commanderCount = deck.commander ? 1 : 0
    
    // Distribuzione CMC
    const cmcDistribution = deck.main.reduce((acc, card) => {
      const cmc = Math.min(card.mana_value || 0, 7)
      const key = cmc === 7 ? '7+' : cmc.toString()
      acc[key] = (acc[key] || 0) + card.quantity
      return acc
    }, {} as Record<string, number>)
    
    // Distribuzione colori
    const colorCounts = deck.main.reduce((acc, card) => {
      (card.colors || []).forEach(color => {
        acc[color] = (acc[color] || 0) + card.quantity
      })
      return acc
    }, {} as Record<string, number>)
    
    // Distribuzione tipi
    const typeCounts = deck.main.reduce((acc, card) => {
      const mainType = card.types?.[0] || 'Other'
      acc[mainType] = (acc[mainType] || 0) + card.quantity
      return acc
    }, {} as Record<string, number>)

    return {
      mainCount,
      sideCount, 
      commanderCount,
      cmcDistribution,
      colorCounts,
      typeCounts,
      avgCMC: mainCount > 0 ? 
        deck.main.reduce((sum, card) => sum + (card.mana_value || 0) * card.quantity, 0) / mainCount : 0
    }
  }, [deck])

  // Controlla legalità del mazzo
  const deckLegality = useMemo(() => {
    const errors = []
    const warnings = []

    if (deck.format === 'standard') {
      if (deckStats.mainCount < 60) errors.push(`Main deck troppo piccolo (${deckStats.mainCount}/60)`)
      if (deckStats.mainCount > 60) warnings.push(`Main deck troppo grande (${deckStats.mainCount}/60)`)
      if (deck.bo_mode === 'bo3' && deckStats.sideCount > 15) errors.push(`Sideboard troppo grande (${deckStats.sideCount}/15)`)
      
      // Controlla limite 4x
      const violations = deck.main.filter(card => 
        card.quantity > 4 && !card.types?.includes('Basic') && !card.types?.includes('Land')
      )
      violations.forEach(card => errors.push(`Troppe copie di ${card.name} (${card.quantity}/4)`))
      
    } else if (deck.format === 'brawl') {
      if (!deck.commander) errors.push('Comandante mancante')
      if (deckStats.mainCount !== 99) {
        if (deckStats.mainCount < 99) errors.push(`Deck troppo piccolo (${deckStats.mainCount}/99)`)
        else errors.push(`Deck troppo grande (${deckStats.mainCount}/99)`)
      }
      if (deckStats.sideCount > 0) errors.push('Historic Brawl non ammette sideboard')
      
      // Controlla singleton
      const violations = deck.main.filter(card => card.quantity > 1)
      violations.forEach(card => errors.push(`${card.name} deve essere singleton (${card.quantity}/1)`))
      
      // Controlla identità colore
      if (deck.commander) {
        const commanderColors = deck.commander.color_identity || []
        const violations = deck.main.filter(card => 
          (card.color_identity || []).some(color => !commanderColors.includes(color))
        )
        violations.forEach(card => errors.push(`${card.name} non rispetta identità colore del comandante`))
      }
    }

    return { errors, warnings, isLegal: errors.length === 0 }
  }, [deck, deckStats])

  const updateDeck = (newDeck: DeckData) => {
    setDeck(newDeck)
    if (onDeckChange) {
      onDeckChange(newDeck)
    }
  }

  const addCard = (card: Card, quantity: number) => {
    const maxQuantity = deck.format === 'brawl' ? 1 : 4
    const actualQuantity = Math.min(quantity, maxQuantity)
    
    const newDeck = { ...deck }
    const existingIndex = newDeck.main.findIndex(c => c.id === card.id)
    
    if (existingIndex >= 0) {
      newDeck.main[existingIndex].quantity = Math.min(
        newDeck.main[existingIndex].quantity + actualQuantity, 
        maxQuantity
      )
    } else {
      newDeck.main.push({
        ...card,
        quantity: actualQuantity,
        role: 'main'
      })
    }
    
    updateDeck(newDeck)
  }

  const removeCard = (cardId: string, fromSection: 'main' | 'side' | 'commander') => {
    const newDeck = { ...deck }
    
    if (fromSection === 'commander' && newDeck.commander?.id === cardId) {
      newDeck.commander = undefined
    } else {
      const section = fromSection === 'main' ? newDeck.main : newDeck.side
      const index = section.findIndex(c => c.id === cardId)
      if (index >= 0) {
        section.splice(index, 1)
      }
    }
    
    updateDeck(newDeck)
  }

  const updateCardQuantity = (cardId: string, quantity: number, section: 'main' | 'side') => {
    const newDeck = { ...deck }
    const targetSection = section === 'main' ? newDeck.main : newDeck.side
    const cardIndex = targetSection.findIndex(c => c.id === cardId)
    
    if (cardIndex >= 0) {
      if (quantity <= 0) {
        targetSection.splice(cardIndex, 1)
      } else {
        const maxQuantity = deck.format === 'brawl' ? 1 : 4
        targetSection[cardIndex].quantity = Math.min(quantity, maxQuantity)
      }
      updateDeck(newDeck)
    }
  }

  const exportText = useMemo(() => {
    const lines: string[] = []
    
    // Commander per Brawl
    if (deck.format === 'brawl' && deck.commander) {
      lines.push('Commander')
      const cmd = deck.commander
      lines.push(`1 ${cmd.name} (${cmd.set_code}) ${cmd.collector_number}`)
      lines.push('')
    }
    
    // Main deck
    lines.push('Deck')
    deck.main
      .sort((a, b) => (a.mana_value || 0) - (b.mana_value || 0) || a.name.localeCompare(b.name))
      .forEach(card => {
        lines.push(`${card.quantity} ${card.name} (${card.set_code}) ${card.collector_number}`)
      })
    
    // Sideboard (solo per Standard)
    if (deck.format !== 'brawl' && deck.side.length > 0) {
      lines.push('', 'Sideboard')
      deck.side
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(card => {
          lines.push(`${card.quantity} ${card.name} (${card.set_code}) ${card.collector_number}`)
        })
    }
    
    return lines.join('\n')
  }, [deck])

  const handleRefine = async (action: string) => {
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck, action })
      })
      const data = await res.json()
      if (data.ok) {
        updateDeck(data.deck)
      }
    } catch (error) {
      console.error('Error refining deck:', error)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {deck.name || `${deck.format.charAt(0).toUpperCase() + deck.format.slice(1)} Deck`}
          </h2>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              deckLegality.isLegal 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {deckLegality.isLegal ? 'Legale' : 'Non legale'}
            </span>
            <span className="text-sm text-gray-300">
              {deck.format === 'brawl' ? 
                `${deckStats.mainCount}/99 + Comandante` : 
                `${deckStats.mainCount}/60 Main, ${deckStats.sideCount}/15 Side`
              }
            </span>
          </div>
        </div>

        {/* Stats rapide */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-orange-400">{deckStats.mainCount}</div>
            <div className="text-xs text-gray-400">Carte Main</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">{deckStats.avgCMC.toFixed(1)}</div>
            <div className="text-xs text-gray-400">CMC Medio</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{Object.keys(deckStats.colorCounts).length}</div>
            <div className="text-xs text-gray-400">Colori</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">{Object.keys(deckStats.typeCounts).length}</div>
            <div className="text-xs text-gray-400">Tipi</div>
          </div>
        </div>

        {/* Errori legalità */}
        {deckLegality.errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded border border-red-600">
            <h4 className="font-medium text-red-400 mb-2">Errori:</h4>
            <ul className="text-sm text-red-300 space-y-1">
              {deckLegality.errors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-4">
        <button
          onClick={() => setActiveTab('deck')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'deck' 
              ? 'bg-orange-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Lista Mazzo
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'library' 
              ? 'bg-orange-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Libreria Carte
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'deck' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* Lista carte */}
            <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4 overflow-y-auto">
              {/* Commander (Brawl only) */}
              {deck.format === 'brawl' && (
                <div className="mb-6">
                  <h3 className="font-semibold text-white mb-3">Comandante</h3>
                  {deck.commander ? (
                    <div className="flex items-center space-x-3">
                      <CardPreview 
                        card={deck.commander} 
                        size="small"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">{deck.commander.name}</div>
                        <button
                          onClick={() => removeCard(deck.commander!.id, 'commander')}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Rimuovi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">Nessun comandante selezionato</div>
                  )}
                </div>
              )}

              {/* Main deck */}
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-3">
                  Main Deck ({deckStats.mainCount})
                </h3>
                <div className="space-y-2">
                  {deck.main.map(card => (
                    <div key={card.id} className="flex items-center space-x-3 bg-gray-700 p-2 rounded">
                      <CardPreview 
                        card={card} 
                        size="small"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{card.name}</div>
                        <div className="text-sm text-gray-400">
                          {card.mana_cost} • {card.types?.join(' ')}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CardPreview 
                          card={card}
                          size="small"
                          showQuantity={true}
                          quantity={card.quantity}
                          onQuantityChange={(newQuantity) => 
                            updateCardQuantity(card.id, newQuantity, 'main')
                          }
                          maxQuantity={deck.format === 'brawl' ? 1 : 4}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sideboard (Standard only) */}
              {deck.format !== 'brawl' && (
                <div>
                  <h3 className="font-semibold text-white mb-3">
                    Sideboard ({deckStats.sideCount})
                  </h3>
                  <div className="space-y-2">
                    {deck.side.map(card => (
                      <div key={card.id} className="flex items-center space-x-3 bg-gray-700 p-2 rounded">
                        <CardPreview 
                          card={card} 
                          size="small"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{card.name}</div>
                        </div>
                        <CardPreview 
                          card={card}
                          size="small" 
                          showQuantity={true}
                          quantity={card.quantity}
                          onQuantityChange={(newQuantity) => 
                            updateCardQuantity(card.id, newQuantity, 'side')
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tools sidebar */}
            <div className="space-y-4">
              {/* Quick actions */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Azioni Rapide</h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => handleRefine('moreRemoval')}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
                  >
                    + Removal
                  </button>
                  <button 
                    onClick={() => handleRefine('lowerCurve')}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
                  >
                    Curva più bassa
                  </button>
                  <button 
                    onClick={() => handleRefine('saferMana')}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
                  >
                    Mana più sicuro
                  </button>
                  <button 
                    onClick={() => handleRefine('budget')}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
                  >
                    Versione budget
                  </button>
                </div>
              </div>

              {/* Export */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Export</h3>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  Esporta per MTG Arena
                </button>
              </div>
            </div>
          </div>
        ) : (
          <CardLibrary
            format={deck.format}
            onCardAdd={addCard}
            commanderColorIdentity={deck.commander?.color_identity}
            className="h-full"
          />
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Export MTG Arena</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <textarea
              value={exportText}
              readOnly
              rows={20}
              className="w-full bg-gray-900 text-white p-3 rounded font-mono text-sm border border-gray-600"
            />
            
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-400">
                Copia tutto → MTG Arena → Decks → Import
              </p>
              <div className="space-x-2">
                <button
                  onClick={() => navigator.clipboard.writeText(exportText)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  Copia
                </button>
                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(exportText)}`}
                  download={`${deck.name || 'deck'}.mtga.txt`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors inline-block"
                >
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}