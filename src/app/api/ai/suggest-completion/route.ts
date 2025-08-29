// src/app/api/ai/suggest-completion/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Card {
  id: string
  name: string
  mana_cost: string | null
  mana_value: number | null
  colors: string[]
  color_identity: string[]
  types: string[]
  oracle_text: string | null
  rarity: string | null
  set_code: string | null
  image_url: string | null
}

interface DeckCard extends Card {
  quantity: number
  role: string
}

interface DeckAnalysis {
  total_cards: number
  cards_needed: number
  mana_curve: Record<string, number>
  color_distribution: Record<string, number>
  type_distribution: Record<string, number>
  missing_categories: string[]
  weaknesses: string[]
  suggestions: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deck, current_cards = 0, target_cards = 60, format = 'standard' } = body

    if (!deck || !deck.main) {
      return NextResponse.json({ 
        error: 'Deck data is required',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Analyzing deck for completion: ${current_cards}/${target_cards} cards`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get card pool
    const { data: cardPool, error } = await supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)
      .limit(2000)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        error: 'Database error: ' + error.message,
        ok: false 
      }, { status: 500 })
    }

    // Safe card filtering
    const validCards = (cardPool || []).filter((card: Card) => {
      try {
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        if (!Array.isArray(card.color_identity)) return false
        if (!Array.isArray(card.types)) return false
        return true
      } catch (e) {
        return false
      }
    })

    // Analyze current deck
    const deckAnalysis = analyzeDeck(deck, target_cards)
    console.log('Deck analysis:', deckAnalysis)

    // Generate suggestions
    const suggestions = await generateCompletionSuggestions(
      deck, 
      deckAnalysis, 
      validCards, 
      format
    )

    return NextResponse.json({
      ok: true,
      analysis: deckAnalysis,
      suggested_cards: suggestions,
      cards_to_add: suggestions.length,
      completion_strategy: getCompletionStrategy(deckAnalysis)
    })

  } catch (error: any) {
    console.error('Error analyzing deck:', error)
    return NextResponse.json({ 
      error: 'Analysis failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

function analyzeDeck(deck: any, targetCards: number): DeckAnalysis {
  const mainDeck = deck.main || []
  const totalCards = mainDeck.reduce((sum: number, card: DeckCard) => sum + card.quantity, 0)
  const cardsNeeded = Math.max(0, targetCards - totalCards)

  // Analyze mana curve
  const manaCurve = mainDeck.reduce((acc: Record<string, number>, card: DeckCard) => {
    const cmc = Math.min(card.mana_value || 0, 7)
    const key = cmc === 7 ? '7+' : cmc.toString()
    acc[key] = (acc[key] || 0) + card.quantity
    return acc
  }, {})

  // Analyze colors
  const colorDistribution = mainDeck.reduce((acc: Record<string, number>, card: DeckCard) => {
    (card.colors || []).forEach((color: string) => {
      acc[color] = (acc[color] || 0) + card.quantity
    })
    return acc
  }, {})

  // Analyze card types
  const typeDistribution = mainDeck.reduce((acc: Record<string, number>, card: DeckCard) => {
    const mainType = card.types?.[0] || 'Other'
    acc[mainType] = (acc[mainType] || 0) + card.quantity
    return acc
  }, {})

  // Identify missing categories and weaknesses
  const creatures = typeDistribution['Creature'] || 0
  const instants = typeDistribution['Instant'] || 0
  const sorceries = typeDistribution['Sorcery'] || 0
  const lands = typeDistribution['Land'] || 0
  const artifacts = typeDistribution['Artifact'] || 0
  const enchantments = typeDistribution['Enchantment'] || 0

  const missingCategories = []
  const weaknesses = []
  const suggestions = []

  // Check land count
  const landRatio = lands / totalCards
  if (landRatio < 0.35) {
    missingCategories.push('lands')
    weaknesses.push('Base mana insufficiente')
    suggestions.push('Aggiungi più terre per stabilità')
  }

  // Check creature count  
  const creatureRatio = creatures / totalCards
  if (creatureRatio < 0.15) {
    missingCategories.push('creatures')
    weaknesses.push('Poche minacce')
    suggestions.push('Serve più pressione con creature')
  }

  // Check removal/interaction
  const removalCards = mainDeck.filter((card: DeckCard) => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('destroy') || text.includes('exile') || 
           text.includes('damage') || text.includes('counter')
  }).length

  if (removalCards < 4) {
    missingCategories.push('removal')
    weaknesses.push('Poca interazione')
    suggestions.push('Aggiungi removal/contromagie')
  }

  // Check card draw
  const drawCards = mainDeck.filter((card: DeckCard) => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('draw') && !text.includes('drawback')
  }).length

  if (drawCards < 2) {
    missingCategories.push('card_draw')
    weaknesses.push('Poco card advantage')
    suggestions.push('Serve più pescaggio carte')
  }

  // Check mana curve balance
  const lowCostCards = (manaCurve['0'] || 0) + (manaCurve['1'] || 0) + (manaCurve['2'] || 0)
  const midCostCards = (manaCurve['3'] || 0) + (manaCurve['4'] || 0)
  const highCostCards = (manaCurve['5'] || 0) + (manaCurve['6'] || 0) + (manaCurve['7+'] || 0)

  if (lowCostCards < 8) {
    weaknesses.push('Curva troppo alta')
    suggestions.push('Serve più gioco early game')
  }

  if (midCostCards < 6) {
    weaknesses.push('Poco midrange')
    suggestions.push('Aggiungi minacce 3-4 mana')
  }

  return {
    total_cards: totalCards,
    cards_needed: cardsNeeded,
    mana_curve: manaCurve,
    color_distribution: colorDistribution,
    type_distribution: typeDistribution,
    missing_categories: missingCategories,
    weaknesses,
    suggestions
  }
}

async function generateCompletionSuggestions(
  deck: any, 
  analysis: DeckAnalysis, 
  cardPool: Card[], 
  format: string
): Promise<DeckCard[]> {
  
  const deckColors = Object.keys(analysis.color_distribution)
  const suggestions: DeckCard[] = []
  const usedCardIds = new Set(deck.main.map((card: DeckCard) => card.id))

  // Priority categories based on analysis
  const priorities = [
    {
      category: 'lands',
      count: Math.max(0, Math.min(8, Math.floor(analysis.cards_needed * 0.4))),
      filter: (card: Card) => (card.types || []).includes('Land'),
      needed: analysis.missing_categories.includes('lands')
    },
    {
      category: 'removal', 
      count: Math.max(0, Math.min(6, Math.floor(analysis.cards_needed * 0.2))),
      filter: (card: Card) => {
        const text = (card.oracle_text || '').toLowerCase()
        return text.includes('destroy') || text.includes('exile') || 
               text.includes('damage') || text.includes('counter')
      },
      needed: analysis.missing_categories.includes('removal')
    },
    {
      category: 'creatures',
      count: Math.max(0, Math.min(12, Math.floor(analysis.cards_needed * 0.3))),
      filter: (card: Card) => (card.types || []).includes('Creature'),
      needed: analysis.missing_categories.includes('creatures')
    },
    {
      category: 'card_draw',
      count: Math.max(0, Math.min(4, Math.floor(analysis.cards_needed * 0.1))),
      filter: (card: Card) => {
        const text = (card.oracle_text || '').toLowerCase()
        return text.includes('draw') && !text.includes('drawback')
      },
      needed: analysis.missing_categories.includes('card_draw')
    }
  ]

  // Add cards by priority
  for (const priority of priorities) {
    if (!priority.needed || suggestions.length >= analysis.cards_needed) continue

    const categoryCards = cardPool
      .filter((card: Card) => {
        if (usedCardIds.has(card.id)) return false
        
        try {
          // Color filtering
          const cardColors = card.color_identity || []
          if (cardColors.length > 0 && !cardColors.every(color => deckColors.includes(color))) {
            return false
          }
          
          return priority.filter(card)
        } catch (e) {
          return false
        }
      })
      .sort((a: Card, b: Card) => {
        // Prefer cards that match deck colors exactly
        const aColorMatch = (a.color_identity || []).every(color => deckColors.includes(color))
        const bColorMatch = (b.color_identity || []).every(color => deckColors.includes(color))
        if (aColorMatch && !bColorMatch) return -1
        if (!aColorMatch && bColorMatch) return 1
        
        // Then by mana value
        return (a.mana_value || 0) - (b.mana_value || 0)
      })
      .slice(0, priority.count)

    categoryCards.forEach((card: Card) => {
      if (suggestions.length < analysis.cards_needed) {
        const quantity = format === 'brawl' ? 1 : Math.min(4, 2)
        suggestions.push({
          ...card,
          quantity,
          role: priority.category
        })
        usedCardIds.add(card.id)
      }
    })
  }

  // Fill remaining slots with generic good cards
  const remainingNeeded = Math.max(0, analysis.cards_needed - suggestions.length)
  if (remainingNeeded > 0) {
    const genericGoodCards = cardPool
      .filter((card: Card) => {
        if (usedCardIds.has(card.id)) return false
        
        const cardColors = card.color_identity || []
        if (cardColors.length > 0 && !cardColors.every(color => deckColors.includes(color))) {
          return false
        }
        
        // Good generic cards criteria
        const manaValue = card.mana_value || 0
        return manaValue >= 1 && manaValue <= 5 && (card.types || []).some(type => 
          ['Creature', 'Instant', 'Sorcery'].includes(type)
        )
      })
      .sort((a: Card, b: Card) => (a.mana_value || 0) - (b.mana_value || 0))
      .slice(0, remainingNeeded)

    genericGoodCards.forEach((card: Card) => {
      const quantity = format === 'brawl' ? 1 : Math.min(4, 2)
      suggestions.push({
        ...card,
        quantity,
        role: 'generic'
      })
    })
  }

  return suggestions
}

function getCompletionStrategy(analysis: DeckAnalysis): string {
  const strategies = []
  
  if (analysis.missing_categories.includes('lands')) {
    strategies.push('Stabilizzare base mana')
  }
  if (analysis.missing_categories.includes('removal')) {
    strategies.push('Aggiungere interazione')
  }
  if (analysis.missing_categories.includes('creatures')) {
    strategies.push('Aumentare pressione')
  }
  if (analysis.missing_categories.includes('card_draw')) {
    strategies.push('Migliorare card advantage')
  }

  return strategies.length > 0 ? strategies.join(', ') : 'Ottimizzazione generale'
}