// src/app/api/ai/build-combo-deck/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

interface Card {
  id: string
  name: string
  mana_cost: string
  mana_value: number
  colors: string[]
  color_identity: string[]
  types: string[]
  oracle_text: string
  rarity: string
  set_code: string
  collector_number: string
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

async function buildOptimalDeckList(
  comboCores: Card[],
  colors: string[],
  format: string,
  supa: any
): Promise<{ main: any[], side: any[], commander?: any }> {
  
  // Fetch supporting cards pool
  let query = supa
    .from('cards')
    .select('*')
    .eq('in_arena', true)
    .overlaps('color_identity', colors)

  if (format === 'standard') {
    query = query.eq('legal_standard', true)
  } else if (format === 'historic') {
    query = query.eq('legal_historic', true)
  } else if (format === 'brawl') {
    query = query.eq('legal_brawl', true)
  }

  const { data: cardPool } = await query.limit(1000)
  const cards = cardPool || []

  const deckList: Array<{card_id: string, quantity: number, role: string}> = []
  const usedCards = new Set<string>()

  // Add combo pieces (priority)
  comboCores.forEach(card => {
    if (!usedCards.has(card.id)) {
      const quantity = format === 'brawl' ? 1 : Math.min(4, 2) // 2x for combo pieces
      deckList.push({
        card_id: card.id,
        quantity,
        role: 'main'
      })
      usedCards.add(card.id)
    }
  })

  // Calculate mana curve needs
  const comboAvgCMC = comboCores.reduce((sum, c) => sum + (c.mana_value || 0), 0) / comboCores.length
  
  // Add supporting cards by category
  const supportCategories = [
    {
      name: 'ramp',
      count: format === 'brawl' ? 8 : 6,
      filter: (c: Card) => c.oracle_text.toLowerCase().includes('add') && 
                           c.oracle_text.toLowerCase().includes('mana') &&
                           c.mana_value <= 3
    },
    {
      name: 'draw',
      count: format === 'brawl' ? 10 : 8,
      filter: (c: Card) => (c.oracle_text.toLowerCase().includes('draw') && 
                           c.oracle_text.toLowerCase().includes('card')) ||
                          c.types.includes('Planeswalker')
    },
    {
      name: 'removal',
      count: format === 'brawl' ? 8 : 6,
      filter: (c: Card) => c.oracle_text.toLowerCase().includes('destroy') ||
                          c.oracle_text.toLowerCase().includes('exile') ||
                          (c.types.includes('Instant') && c.oracle_text.toLowerCase().includes('damage'))
    },
    {
      name: 'protection',
      count: format === 'brawl' ? 5 : 4,
      filter: (c: Card) => c.oracle_text.toLowerCase().includes('counter target spell') ||
                          c.oracle_text.toLowerCase().includes('hexproof') ||
                          c.oracle_text.toLowerCase().includes('ward')
    }
  ]

  // Fill deck with support cards
  for (const category of supportCategories) {
    const categoryCards = cards
      .filter(category.filter)
      .filter(c => !usedCards.has(c.id))
      .sort((a, b) => {
        // Prefer cards that match combo colors exactly
        const aColorMatch = a.color_identity.every(color => colors.includes(color))
        const bColorMatch = b.color_identity.every(color => colors.includes(color))
        if (aColorMatch !== bColorMatch) return aColorMatch ? -1 : 1
        
        // Prefer lower CMC for ramp/removal, higher for threats
        if (category.name === 'ramp' || category.name === 'removal') {
          return (a.mana_value || 0) - (b.mana_value || 0)
        }
        return (b.mana_value || 0) - (a.mana_value || 0)
      })
      .slice(0, category.count)

    categoryCards.forEach(card => {
      if (deckList.length < (format === 'brawl' ? 99 : 60)) {
        const quantity = format === 'brawl' ? 1 : Math.min(4, category.name === 'removal' ? 3 : 2)
        deckList.push({
          card_id: card.id,
          quantity,
          role: 'main'
        })
        usedCards.add(card.id)
      }
    })
  }

  // Add lands
  const landsNeeded = format === 'brawl' ? 
    (99 - deckList.reduce((sum, c) => sum + c.quantity, 0)) :
    (60 - deckList.reduce((sum, c) => sum + c.quantity, 0))

  const landCards = cards.filter(c => 
    c.types.includes('Land') && 
    !usedCards.has(c.id) &&
    (c.color_identity.length === 0 || c.color_identity.every(color => colors.includes(color)))
  )

  // Add dual lands first, then basics
  const dualLands = landCards.filter(c => c.color_identity.length > 1).slice(0, Math.floor(landsNeeded * 0.4))
  const basicLands = landCards.filter(c => c.oracle_text.toLowerCase().includes('basic')).slice(0, landsNeeded - dualLands.length)

  const allLands = dualLands.concat(basicLands)
  allLands.forEach(land => {
    if (deckList.reduce((sum, c) => sum + c.quantity, 0) < (format === 'brawl' ? 99 : 60)) {
      deckList.push({
        card_id: land.id,
        quantity: format === 'brawl' ? 1 : Math.min(4, 3),
        role: 'main'
      })
    }
  })

  // Simple sideboard for non-brawl
  const sideboard = format === 'brawl' ? [] : cards
    .filter(c => 
      (c.oracle_text.toLowerCase().includes('destroy') && c.oracle_text.toLowerCase().includes('artifact')) ||
      (c.oracle_text.toLowerCase().includes('graveyard')) ||
      (c.types.includes('Instant') && c.oracle_text.toLowerCase().includes('counter'))
    )
    .filter(c => !usedCards.has(c.id))
    .slice(0, 5)
    .map(card => ({
      card_id: card.id,
      quantity: 3,
      role: 'side'
    }))

  return {
    main: deckList,
    side: sideboard,
    commander: format === 'brawl' ? comboCores.find(c => 
      c.types.includes('Legendary') && c.types.includes('Creature')
    ) : undefined
  }
}

export async function POST(req: NextRequest) {
  try {
    const { selected_combos, format, colors } = await req.json()

    if (!selected_combos || selected_combos.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No combos selected'
      }, { status: 400 })
    }

    if (!colors || colors.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Colors required'
      }, { status: 400 })
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })

    // Extract all unique cards from selected combos
    const allComboCards = selected_combos.flatMap((combo: ComboSuggestion) => combo.cards)
    const uniqueComboCards = allComboCards.filter((card, index, array) => 
      array.findIndex(c => c.id === card.id) === index
    )

    console.log(`Building deck with ${uniqueComboCards.length} combo cards...`)

    // Generate optimal deck list
    const deckStructure = await buildOptimalDeckList(uniqueComboCards, colors, format, supa)

    // Create deck in database
    const { data: deck, error: deckError } = await supa
      .from('decks')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Guest user
        format: format,
        bo_mode: format === 'brawl' ? 'bo1' : 'bo1', // Default to bo1
        name: `AI Combo Deck - ${colors.join('')} (${selected_combos.length} combos)`,
        commander_card_id: deckStructure.commander?.id || null,
        notes: `Generated by AI with combos: ${selected_combos.map((c: ComboSuggestion) => c.description).join(', ')}`
      })
      .select()
      .single()

    if (deckError) {
      throw new Error(`Failed to create deck: ${deckError.message}`)
    }

    // Add cards to deck
    const allDeckCards = [
      ...deckStructure.main,
      ...deckStructure.side,
      ...(deckStructure.commander ? [{ card_id: deckStructure.commander.id, quantity: 1, role: 'commander' }] : [])
    ]

    if (allDeckCards.length > 0) {
      const deckCards = allDeckCards.map(dc => ({
        deck_id: deck.id,
        card_id: dc.card_id,
        quantity: dc.quantity,
        role: dc.role
      }))

      const { error: cardsError } = await supa
        .from('deck_cards')
        .insert(deckCards)

      if (cardsError) {
        // Cleanup deck if card insertion fails
        await supa.from('decks').delete().eq('id', deck.id)
        throw new Error(`Failed to add cards to deck: ${cardsError.message}`)
      }
    }

    console.log(`Successfully created deck ${deck.id} with ${allDeckCards.length} card entries`)

    return NextResponse.json({
      ok: true,
      deck_id: deck.id,
      combo_count: selected_combos.length,
      total_cards: deckStructure.main.reduce((sum: number, c: any) => sum + c.quantity, 0)
    })

  } catch (error: any) {
    console.error('Build combo deck error:', error)
    return NextResponse.json({
      ok: false,
      error: String(error)
    }, { status: 500 })
  }
}