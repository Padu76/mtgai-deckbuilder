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

    if (!colors || colors.length === 0) {
      return NextResponse.json({ 
        error: 'Colors array is required',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Building ${format} deck from ${selected_combos.length} combos for colors: ${colors.join(', ')}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get card pool with format filtering - same as analyze-combos
    let query = supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)

    // Add format filtering
    if (format === 'standard') {
      query = query.eq('legal_standard', true)
    } else if (format === 'historic' || format === 'brawl') {
      query = query.eq('legal_historic', true)
    }

    const { data: cardPool, error } = await query.limit(3000)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        error: 'Database error: ' + error.message,
        ok: false 
      }, { status: 500 })
    }

    // FIXED: Strict color filtering matching analyze-combos
    const validCards = (cardPool || []).filter((card: Card) => {
      try {
        // Ensure required fields exist and are valid
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        if (!Array.isArray(card.color_identity)) return false
        if (!Array.isArray(card.types)) return false
        
        // FIXED: Strict color identity matching
        const cardColors = card.color_identity || []
        
        // Colorless cards (no color identity) are always allowed
        if (cardColors.length === 0) return true
        
        // Card must have ONLY colors that are in our selected colors
        return cardColors.every((color: string) => colors.includes(color))
      } catch (e) {
        console.warn(`Card validation error for card ${card.id}:`, e)
        return false
      }
    })

    console.log(`Processing ${validCards.length} valid cards matching colors ${colors.join(', ')} in ${format} format`)

    const deckList: Array<{card_id: string, quantity: number, role: string}> = []
    const usedCards = new Set<string>()

    // FIXED: Add combo pieces as PRIORITY with correct quantity for format
    console.log('Adding combo pieces...')
    for (const combo of selected_combos) {
      console.log(`Processing combo: ${combo.description}`)
      for (const comboCard of combo.cards) {
        if (!usedCards.has(comboCard.id)) {
          // FIXED: Correct quantity based on format
          const quantity = format === 'brawl' ? 1 : 4
          deckList.push({
            card_id: comboCard.id,
            quantity,
            role: 'combo_piece'
          })
          usedCards.add(comboCard.id)
          console.log(`Added ${comboCard.name} x${quantity} as combo piece`)
        }
      }
    }

    console.log(`Added ${deckList.length} unique combo pieces`)

    // FIXED: Format-specific deck building strategy
    const isBrawl = format === 'brawl'
    const targetCards = isBrawl ? 100 : 60
    const landRatio = isBrawl ? 0.38 : 0.4 // Slightly more lands for Brawl

    // Define support categories with format-specific counts
    const supportCategories = [
      {
        name: 'ramp',
        count: isBrawl ? 10 : 6,
        priority: 1,
        filter: (card: Card) => {
          try {
            const text = (card.oracle_text || '').toLowerCase()
            return (
              (text.includes('add') && text.includes('mana')) ||
              (text.includes('search') && text.includes('land')) ||
              text.includes('ramp')
            ) && (card.mana_value || 0) <= 4
          } catch (e) {
            return false
          }
        }
      },
      {
        name: 'removal', 
        count: isBrawl ? 12 : 8,
        priority: 1,
        filter: (card: Card) => {
          try {
            const text = (card.oracle_text || '').toLowerCase()
            return (
              text.includes('destroy') || 
              text.includes('exile') || 
              (text.includes('damage') && (card.types || []).some(t => ['Instant', 'Sorcery'].includes(t))) ||
              text.includes('counter target spell')
            ) && (card.mana_value || 0) <= 6
          } catch (e) {
            return false
          }
        }
      },
      {
        name: 'card_draw',
        count: isBrawl ? 8 : 4,
        priority: 2,
        filter: (card: Card) => {
          try {
            const text = (card.oracle_text || '').toLowerCase()
            return (
              (text.includes('draw') && !text.includes('drawback')) ||
              text.includes('scry') ||
              text.includes('surveil')
            ) && (card.mana_value || 0) <= 5
          } catch (e) {
            return false
          }
        }
      },
      {
        name: 'threats',
        count: isBrawl ? 20 : 18,
        priority: 3,
        filter: (card: Card) => {
          try {
            return (
              (card.types || []).includes('Creature') && 
              (card.mana_value || 0) >= 2 && 
              (card.mana_value || 0) <= 7 &&
              // Prefer cards that synergize with our combos
              (card.oracle_text || '').toLowerCase().includes('enters') ||
              (card.oracle_text || '').toLowerCase().includes('death') ||
              (card.oracle_text || '').toLowerCase().includes('sacrifice')
            )
          } catch (e) {
            return false
          }
        }
      },
      {
        name: 'utility',
        count: isBrawl ? 8 : 4,
        priority: 4,
        filter: (card: Card) => {
          try {
            const text = (card.oracle_text || '').toLowerCase()
            return (
              text.includes('tutor') ||
              text.includes('search') ||
              text.includes('protection') ||
              text.includes('hexproof') ||
              text.includes('indestructible')
            ) && (card.mana_value || 0) <= 5
          } catch (e) {
            return false
          }
        }
      }
    ]

    // FIXED: Add support cards with proper format-specific quantities
    for (const category of supportCategories) {
      console.log(`Finding ${category.name} cards...`)
      
      const categoryCards = validCards
        .filter((card: Card) => {
          try {
            return category.filter(card) && !usedCards.has(card.id)
          } catch (e) {
            return false
          }
        })
        .sort((a: Card, b: Card) => {
          // Prefer cards that EXACTLY match our colors (not just subset)
          const aColorMatch = (a.color_identity || []).length > 0 && 
                            (a.color_identity || []).every((color: string) => colors.includes(color))
          const bColorMatch = (b.color_identity || []).length > 0 && 
                            (b.color_identity || []).every((color: string) => colors.includes(color))
          
          if (aColorMatch && !bColorMatch) return -1
          if (!aColorMatch && bColorMatch) return 1
          
          // Then prefer lower mana cost for efficiency
          return (a.mana_value || 0) - (b.mana_value || 0)
        })
        .slice(0, category.count)

      for (const card of categoryCards) {
        if (deckList.length < targetCards - Math.floor(targetCards * landRatio)) {
          // FIXED: Correct quantity for all formats
          const quantity = format === 'brawl' ? 1 : Math.min(4, 3)
          deckList.push({
            card_id: card.id,
            quantity,
            role: category.name
          })
          usedCards.add(card.id)
        }
      }
      
      console.log(`Added ${categoryCards.length} ${category.name} cards`)
    }

    console.log(`Non-land cards: ${deckList.length} entries`)

    // FIXED: Land selection with proper mana base
    const currentCardCount = deckList.reduce((sum, card) => sum + card.quantity, 0)
    const landsNeeded = targetCards - currentCardCount
    
    console.log(`Need ${landsNeeded} lands to reach ${targetCards} cards`)

    // Smart land selection based on colors
    const coloredLands = validCards.filter((c: Card) => {
      try {
        const types = c.types || []
        const colorId = c.color_identity || []
        const text = (c.oracle_text || '').toLowerCase()
        
        return (
          types.includes('Land') && 
          !usedCards.has(c.id) &&
          (
            // Dual lands that produce our colors
            (colorId.length === 2 && colorId.every(color => colors.includes(color))) ||
            // Basic lands of our colors
            (colorId.length === 1 && colors.includes(colorId[0]) && text.includes('basic')) ||
            // Utility lands that are colorless but useful
            (colorId.length === 0 && (text.includes('draw') || text.includes('scry') || text.includes('life')))
          )
        )
      } catch (e) {
        return false
      }
    })

    // Prioritize dual lands, then basics, then utility
    const dualLands = coloredLands.filter(c => (c.color_identity || []).length === 2)
    const basicLands = coloredLands.filter(c => (c.oracle_text || '').toLowerCase().includes('basic'))
    const utilityLands = coloredLands.filter(c => (c.color_identity || []).length === 0)

    // Calculate land distribution
    const dualCount = Math.min(dualLands.length, Math.floor(landsNeeded * 0.3))
    const basicCount = Math.min(basicLands.length, landsNeeded - dualCount - Math.min(3, utilityLands.length))
    const utilityCount = Math.min(utilityLands.length, 3)

    // Add lands to deck
    dualLands.slice(0, dualCount).forEach((land: Card) => {
      const quantity = format === 'brawl' ? 1 : Math.min(4, 2)
      deckList.push({
        card_id: land.id,
        quantity,
        role: 'dual_land'
      })
    })

    basicLands.slice(0, basicCount).forEach((land: Card) => {
      const quantity = format === 'brawl' ? 1 : Math.min(4, 3)
      deckList.push({
        card_id: land.id,
        quantity,
        role: 'basic_land'
      })
    })

    utilityLands.slice(0, utilityCount).forEach((land: Card) => {
      const quantity = format === 'brawl' ? 1 : 1
      deckList.push({
        card_id: land.id,
        quantity,
        role: 'utility_land'
      })
    })

    const finalCardCount = deckList.reduce((sum, card) => sum + card.quantity, 0)
    console.log(`Final deck: ${deckList.length} unique cards, ${finalCardCount} total cards`)

    // Create deck record with proper data
    const deckData = {
      format,
      bo_mode: 'bo1',
      name: `AI ${format.charAt(0).toUpperCase() + format.slice(1)} Combo Deck - ${colors.join('')}`,
      notes: `Generated from ${selected_combos.length} combo(s): ${selected_combos.map(c => c.description).join(', ')}`,
      is_public: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Try to save to database, but continue if it fails
    try {
      const { data: deck, error: deckError } = await supabase
        .from('decks')
        .insert(deckData)
        .select()
        .single()

      if (!deckError && deck) {
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
          total_cards: finalCardCount,
          format: format,
          colors: colors,
          combo_descriptions: selected_combos.map(c => c.description)
        })
      }
    } catch (dbError) {
      console.warn('Database save failed, returning deck data anyway:', dbError)
    }

    // Return deck even if save failed
    return NextResponse.json({
      ok: true,
      deck_id: `temp_${Date.now()}`,
      deck: deckList,
      combos_integrated: selected_combos.length,
      total_cards: finalCardCount,
      format: format,
      colors: colors,
      combo_descriptions: selected_combos.map(c => c.description),
      message: 'Deck generated successfully (database save failed)'
    })

  } catch (error: any) {
    console.error('Error building deck:', error)
    return NextResponse.json({ 
      error: 'Failed to build deck: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}