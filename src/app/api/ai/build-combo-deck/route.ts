// src/app/api/ai/build-combo-deck/route.ts
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
  power: string | null
  toughness: string | null
  rarity: string | null
  set_code: string | null
  image_url: string | null
}

interface DeckCard {
  card_id: string
  quantity: number
  role: string
}

interface ComboSuggestion {
  id: string
  cards: Card[]
  category: string
  type: string
  description: string
  steps: string[]
  reliability: string
  setup_turns: number
  mana_cost_total: number
  power_level: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { selected_combos, format = 'historic', colors = [] } = body

    if (!selected_combos || selected_combos.length === 0) {
      return NextResponse.json({ 
        error: 'No combos selected',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Building deck from ${selected_combos.length} combos with card pool available`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get card pool with null safety
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

    // Safe card filtering with null checks
    const validCards = (cardPool || []).filter((card: Card) => {
      try {
        // Ensure required fields exist and are valid
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        if (!Array.isArray(card.color_identity)) return false
        if (!Array.isArray(card.types)) return false
        
        return true
      } catch (e) {
        console.warn(`Card validation error for card ${card.id}:`, e)
        return false
      }
    })

    // Process cards safely
    const processedCards = validCards.map((card: Card) => ({
      ...card,
      oracle_text: card.oracle_text || '',
      name: card.name || '',
      types: Array.isArray(card.types) ? card.types : [],
      color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
      colors: Array.isArray(card.colors) ? card.colors : []
    }))

    console.log(`Processing ${processedCards.length} valid cards for deck building`)

    const deckList: Array<{card_id: string, quantity: number, role: string}> = []
    const usedCards = new Set<string>()

    // Add combo pieces (priority)
    for (const combo of selected_combos) {
      for (const comboCard of combo.cards) {
        if (!usedCards.has(comboCard.id)) {
          const quantity = format === 'brawl' ? 1 : Math.min(4, 2)
          deckList.push({
            card_id: comboCard.id,
            quantity,
            role: 'combo'
          })
          usedCards.add(comboCard.id)
        }
      }
    }

    console.log(`Added ${deckList.length} combo pieces`)

    // Define support categories
    const supportCategories = [
      {
        name: 'ramp',
        count: format === 'brawl' ? 8 : 4,
        filter: (card: Card) => {
          try {
            const text = (card.oracle_text || '').toLowerCase()
            return text.includes('add') && text.includes('mana') && (card.mana_value || 0) <= 3
          } catch (e) {
            return false
          }
        }
      },
      {
        name: 'removal', 
        count: format === 'brawl' ? 6 : 8,
        filter: (card: Card) => {
          try {
            const text = (card.oracle_text || '').toLowerCase()
            return text.includes('destroy') || text.includes('exile') || text.includes('damage')
          } catch (e) {
            return false
          }
        }
      },
      {
        name: 'draw',
        count: format === 'brawl' ? 6 : 4,
        filter: (card: Card) => {
          try {
            const text = (card.oracle_text || '').toLowerCase()
            return text.includes('draw') && !text.includes('drawback')
          } catch (e) {
            return false
          }
        }
      },
      {
        name: 'threats',
        count: format === 'brawl' ? 12 : 16,
        filter: (card: Card) => {
          try {
            return (card.types || []).includes('Creature') && (card.mana_value || 0) >= 2 && (card.mana_value || 0) <= 6
          } catch (e) {
            return false
          }
        }
      }
    ]

    // Add support cards
    for (const category of supportCategories) {
      // Safe filtering with null checks
      const categoryCards = processedCards
        .filter((card: Card) => {
          try {
            return category.filter(card)
          } catch (e) {
            return false
          }
        })
        .filter((c: Card) => !usedCards.has(c.id))
        .sort((a: Card, b: Card) => {
          // Prefer cards that match combo colors exactly
          const aColorMatch = (a.color_identity || []).every((color: string) => colors.includes(color))
          const bColorMatch = (b.color_identity || []).every((color: string) => colors.includes(color))
          if (aColorMatch && !bColorMatch) return -1
          if (!aColorMatch && bColorMatch) return 1
          
          // Then by mana value (lower is better for most categories)
          return (a.mana_value || 0) - (b.mana_value || 0)
        })
        .slice(0, category.count)

      categoryCards.forEach((card: Card) => {
        if (deckList.length < (format === 'brawl' ? 99 : 60)) {
          const quantity = format === 'brawl' ? 1 : Math.min(4, category.name === 'removal' ? 3 : 2)
          deckList.push({
            card_id: card.id,
            quantity,
            role: category.name
          })
          usedCards.add(card.id)
        }
      })
    }

    console.log(`Added support cards, deck now has ${deckList.length} entries`)

    // Land selection with safe filtering
    const landsNeeded = Math.min(24, Math.max(20, 60 - deckList.length))
    
    const landCards = processedCards.filter((c: Card) => {
      try {
        return (
          (c.types || []).includes('Land') && 
          !usedCards.has(c.id) &&
          ((c.color_identity || []).length === 0 || (c.color_identity || []).every((color: string) => colors.includes(color)))
        )
      } catch (e) {
        return false
      }
    })

    console.log(`Found ${landCards.length} potential lands`)

    // Add dual lands first, then basics
    const dualLands = landCards.filter(c => (c.color_identity || []).length > 1).slice(0, Math.floor(landsNeeded * 0.4))
    const basicLands = landCards.filter(c => (c.oracle_text || '').toLowerCase().includes('basic')).slice(0, landsNeeded - dualLands.length)
    
    const allLands = dualLands.concat(basicLands)
    allLands.forEach((land: Card) => {
      const quantity = format === 'brawl' ? 1 : Math.min(4, 2)
      deckList.push({
        card_id: land.id,
        quantity,
        role: 'land'
      })
    })

    console.log(`Final deck has ${deckList.length} card entries`)

    // Create deck record
    const deckData = {
      format,
      colors,
      combo_ids: selected_combos.map((c: ComboSuggestion) => c.id),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .insert(deckData)
      .select()
      .single()

    if (deckError) {
      console.warn('Could not save deck to database:', deckError)
      // Continue without saving - return deck data anyway
      return NextResponse.json({
        ok: true,
        deck_id: `temp_${Date.now()}`,
        deck: deckList,
        message: 'Deck generated successfully (not saved to database)'
      })
    }

    // Save deck cards
    const deckCards = deckList.map(card => ({
      ...card,
      deck_id: deck.id
    }))

    const { error: cardsError } = await supabase
      .from('deck_cards')
      .insert(deckCards)

    if (cardsError) {
      console.warn('Could not save deck cards:', cardsError)
    }

    return NextResponse.json({
      ok: true,
      deck_id: deck.id,
      deck: deckList,
      combos_integrated: selected_combos.length,
      total_cards: deckList.reduce((sum, card) => sum + card.quantity, 0)
    })

  } catch (error: any) {
    console.error('Error building deck:', error)
    return NextResponse.json({ 
      error: 'Failed to build deck: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}