// src/app/deck/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DeckEditor from '../../../components/DeckEditor'

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
  id?: string
  colors?: string[]
  combos?: any[]
}

export default function DeckPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string
  
  const [deck, setDeck] = useState<DeckData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        // Fallback - generate sample deck for demo
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
              id: '4',
              name: 'Swamp',
              mana_cost: '',
              mana_value: 0,
              colors: [],
              color_identity: [],
              types: ['Basic', 'Land', 'Swamp'],
              oracle_text: '{T}: Add {B}.',
              set_code: 'UNF',
              collector_number: '385',
              rarity: 'common',
              quantity: 8,
              role: 'main'
            }
          ],
          side: [],
          combos: [
            {
              id: 'combo1',
              description: 'Ramp + Value Engine',
              cards: ['Llanowar Elves', 'Growth Spiral']
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
                onClick={() => router.push('/combo-builder')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Nuovo Deck
              </button>
            </div>
          </div>
          
          {/* Combo Summary */}
          {deck.combos && deck.combos.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">Combo nel deck:</h3>
              <div className="flex flex-wrap gap-2">
                {deck.combos.map((combo, idx) => (
                  <span
                    key={idx}
                    className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm border border-purple-600/30"
                  >
                    {combo.description}
                  </span>
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
      </div>
    </div>
  )
}