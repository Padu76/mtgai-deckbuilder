// src/app/deck/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DeckEditor from '../../../components/DeckEditor'
import CardPreview from '../../../components/CardPreview'

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

interface ComboInfo {
  id: string
  description: string
  cards: Card[]
  steps: string[]
  reliability: string
  power_level: number
  category: string
}

interface DeckData {
  format: 'standard' | 'brawl'
  bo_mode: 'bo1' | 'bo3'
  commander?: DeckCard
  main: DeckCard[]
  side: DeckCard[]
  name?: string
  id?: string
  colors?: string[]
  combos?: ComboInfo[]
}

export default function DeckPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string
  
  const [deck, setDeck] = useState<DeckData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCombo, setSelectedCombo] = useState<ComboInfo | null>(null)
  const [showComboModal, setShowComboModal] = useState(false)

  useEffect(() => {
    loadDeck()
  }, [deckId])

  const loadDeck = async () => {
    try {
      setLoading(true)
      
      // Try to load deck from API first
      const response = await fetch(`/api/deck/${deckId}`)
      
      if (response.ok) {
        const data = await response.json()
        setDeck(data.deck)
      } else {
        // Enhanced fallback with combo info
        const sampleDeck: DeckData = {
          id: deckId,
          name: 'AI Generated Combo Deck',
          format: 'standard',
          bo_mode: 'bo1',
          colors: ['B', 'G'],
          main: [
            {
              id: '1',
              name: 'Llanowar Elves',
              mana_cost: '{G}',
              mana_value: 1,
              colors: ['G'],
              color_identity: ['G'],
              types: ['Creature', 'Elf', 'Druid'],
              oracle_text: '{T}: Add {G}.',
              set_code: 'M19',
              collector_number: '314',
              rarity: 'common',
              quantity: 4,
              role: 'main'
            },
            {
              id: '2',
              name: 'Growth Spiral',
              mana_cost: '{G}{U}',
              mana_value: 2,
              colors: ['G', 'U'],
              color_identity: ['G', 'U'],
              types: ['Instant'],
              oracle_text: 'Draw a card. You may put a land card from your hand onto the battlefield.',
              set_code: 'RNA',
              collector_number: '178',
              rarity: 'common',
              quantity: 4,
              role: 'main'
            },
            {
              id: '3',
              name: 'Cultivate',
              mana_cost: '{2}{G}',
              mana_value: 3,
              colors: ['G'],
              color_identity: ['G'],
              types: ['Sorcery'],
              oracle_text: 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand.',
              set_code: 'M21',
              collector_number: '177',
              rarity: 'common',
              quantity: 3,
              role: 'main'
            },
            // Add more cards to reach 60
            {
              id: '4',
              name: 'Hydroid Krasis',
              mana_cost: '{X}{G}{U}',
              mana_value: 2,
              colors: ['G', 'U'],
              color_identity: ['G', 'U'],
              types: ['Creature', 'Jellyfish', 'Hydra', 'Beast'],
              oracle_text: 'When you cast this spell, you gain half X life and draw half X cards. Round down each time. Flying, trample',
              set_code: 'RNA',
              collector_number: '183',
              rarity: 'mythic',
              quantity: 2,
              role: 'main'
            },
            {
              id: '5',
              name: 'Forest',
              mana_cost: '',
              mana_value: 0,
              colors: [],
              color_identity: [],
              types: ['Basic', 'Land', 'Forest'],
              oracle_text: '{T}: Add {G}.',
              set_code: 'UNF',
              collector_number: '384',
              rarity: 'common',
              quantity: 12,
              role: 'main'
            },
            {
              id: '6',
              name: 'Island',
              mana_cost: '',
              mana_value: 0,
              colors: [],
              color_identity: [],
              types: ['Basic', 'Land', 'Island'],
              oracle_text: '{T}: Add {U}.',
              set_code: 'UNF',
              collector_number: '381',
              rarity: 'common',
              quantity: 8,
              role: 'main'
            },
            {
              id: '7',
              name: 'Temple of Mystery',
              mana_cost: '',
              mana_value: 0,
              colors: [],
              color_identity: ['G', 'U'],
              types: ['Land'],
              oracle_text: 'Temple of Mystery enters the battlefield tapped. When Temple of Mystery enters the battlefield, scry 1. {T}: Add {G} or {U}.',
              set_code: 'M21',
              collector_number: '254',
              rarity: 'rare',
              quantity: 4,
              role: 'main'
            }
          ],
          side: [],
          combos: [
            {
              id: 'combo1',
              description: 'Ramp + Value Engine',
              category: 'value_engine',
              cards: [
                {
                  id: '1',
                  name: 'Llanowar Elves',
                  mana_cost: '{G}',
                  mana_value: 1,
                  colors: ['G'],
                  oracle_text: '{T}: Add {G}.'
                },
                {
                  id: '2',
                  name: 'Growth Spiral',
                  mana_cost: '{G}{U}',
                  mana_value: 2,
                  colors: ['G', 'U'],
                  oracle_text: 'Draw a card. You may put a land card from your hand onto the battlefield.'
                },
                {
                  id: '3',
                  name: 'Cultivate',
                  mana_cost: '{2}{G}',
                  mana_value: 3,
                  colors: ['G'],
                  oracle_text: 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand.'
                }
              ],
              steps: [
                'T1: Gioca Llanowar Elves',
                'T2: Con il mana extra, gioca Growth Spiral per pescare e mettere una terra',
                'T3: Gioca Cultivate per accelerare ulteriormente',
                'T4+: Hai 5-6 mana disponibili per minacce grosse come Hydroid Krasis'
              ],
              reliability: 'high',
              power_level: 6
            }
          ]
        }
        
        setDeck(sampleDeck)
      }
    } catch (err) {
      console.error('Error loading deck:', err)
      setError('Errore nel caricamento del deck')
    } finally {
      setLoading(false)
    }
  }

  const handleDeckChange = async (updatedDeck: DeckData) => {
    setDeck(updatedDeck)
    
    // Save deck changes to backend
    try {
      await fetch(`/api/deck/${deckId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDeck)
      })
    } catch (err) {
      console.error('Error saving deck:', err)
    }
  }

  const showComboDetails = (combo: ComboInfo) => {
    setSelectedCombo(combo)
    setShowComboModal(true)
  }

  const suggestDeckCompletion = async () => {
    try {
      const response = await fetch('/api/ai/suggest-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck,
          current_cards: deck?.main.length || 0,
          target_cards: 60,
          format: deck?.format
        })
      })

      const data = await response.json()
      if (data.ok) {
        // Add suggested cards to deck
        const updatedDeck = {
          ...deck!,
          main: [...deck!.main, ...data.suggested_cards]
        }
        handleDeckChange(updatedDeck)
      }
    } catch (error) {
      console.error('Error suggesting completion:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-white text-lg">Caricamento deck...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Errore</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/combo-builder')}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Torna al Combo Builder
          </button>
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-gray-400 text-6xl mb-4">🃏</div>
          <h1 className="text-2xl font-bold text-white mb-2">Deck non trovato</h1>
          <p className="text-gray-400 mb-6">Il deck richiesto non esiste o è stato eliminato.</p>
          <button
            onClick={() => router.push('/combo-builder')}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Crea nuovo deck
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/combo-builder')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Torna al Builder
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {deck.name || 'Deck AI Generato'}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span>{deck.format?.charAt(0).toUpperCase() + deck.format?.slice(1)}</span>
                  {deck.colors && deck.colors.length > 0 && (
                    <span>Colori: {deck.colors.join(', ')}</span>
                  )}
                  {deck.combos && deck.combos.length > 0 && (
                    <span>{deck.combos.length} combo integrate</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={suggestDeckCompletion}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                AI Completa Deck
              </button>
              <button
                onClick={() => router.push('/combo-builder')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Nuovo Deck
              </button>
            </div>
          </div>
          
          {/* Combo Summary Enhanced */}
          {deck.combos && deck.combos.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium text-white mb-3">Combo nel deck:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {deck.combos.map((combo, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => showComboDetails(combo)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{combo.description}</h4>
                      <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                        Power {combo.power_level}/10
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      {combo.cards.slice(0, 3).map((card, cardIdx) => (
                        <div key={cardIdx} className="text-xs text-gray-300 bg-gray-600 px-2 py-1 rounded">
                          {card.name}
                        </div>
                      ))}
                      {combo.cards.length > 3 && (
                        <div className="text-xs text-gray-400">+{combo.cards.length - 3}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      Clicca per vedere come funziona
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Deck Editor */}
        <div className="bg-gray-900 rounded-lg p-6">
          <DeckEditor 
            initialDeck={deck}
            onDeckChange={handleDeckChange}
          />
        </div>

        {/* Combo Details Modal */}
        {showComboModal && selectedCombo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{selectedCombo.description}</h3>
                <button
                  onClick={() => setShowComboModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              {/* Combo Cards */}
              <div className="mb-6">
                <h4 className="font-medium text-white mb-3">Carte necessarie:</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  {selectedCombo.cards.map((card, idx) => (
                    <div key={idx} className="bg-gray-700 rounded-lg p-3">
                      <CardPreview 
                        card={card} 
                        size="normal"
                        className="mb-2"
                      />
                      <div className="text-sm text-gray-300">{card.oracle_text}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="mb-6">
                <h4 className="font-medium text-white mb-3">Come funziona:</h4>
                <div className="space-y-2">
                  {selectedCombo.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start space-x-3">
                      <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-gray-300">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  <span className="text-gray-400">Categoria:</span>
                  <span className="text-white">{selectedCombo.category}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-400">Affidabilità:</span>
                  <span className={`${
                    selectedCombo.reliability === 'high' ? 'text-green-400' : 
                    selectedCombo.reliability === 'medium' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {selectedCombo.reliability.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-400">Potenza:</span>
                  <span className="text-white">{selectedCombo.power_level}/10</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}