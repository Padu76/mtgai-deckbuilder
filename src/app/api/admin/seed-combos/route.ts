// src/app/api/admin/seed-combos/route.ts
// API endpoint per eseguire il seeding del database combo dal browser

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

// Combo database - stessa lista dello script originale
const FAMOUS_COMBOS = [
  {
    name: "Exquisite Blood + Sanguine Bond",
    cards: ['Exquisite Blood', 'Sanguine Bond'],
    result_tag: "Infinite damage",
    color_identity: ['W', 'B'],
    steps: "1. Play both enchantments\n2. Gain any amount of life\n3. Sanguine Bond deals damage\n4. Exquisite Blood gains life\n5. Infinite loop kills all opponents",
    category: 'infinite_damage'
  },
  {
    name: "Splinter Twin + Deceiver Exarch", 
    cards: ['Splinter Twin', 'Deceiver Exarch'],
    result_tag: "Infinite hasty creatures",
    color_identity: ['U', 'R'],
    steps: "1. Play Deceiver Exarch\n2. Enchant with Splinter Twin\n3. Tap to create copy\n4. Copy untaps original\n5. Repeat for infinite hasty attackers",
    category: 'infinite_tokens'
  },
  {
    name: "Basalt Monolith + Rings of Brighthearth",
    cards: ['Basalt Monolith', 'Rings of Brighthearth'],
    result_tag: "Infinite colorless mana",
    color_identity: [],
    steps: "1. Play both artifacts\n2. Tap Monolith for 3 mana\n3. Pay 3 to untap Monolith\n4. Pay 2 to copy ability with Rings\n5. Net +1 mana per loop",
    category: 'infinite_mana'
  },
  {
    name: "Kiki-Jiki + Restoration Angel",
    cards: ['Kiki-Jiki, Mirror Breaker', 'Restoration Angel'],
    result_tag: "Infinite hasty tokens",
    color_identity: ['R', 'W'],
    steps: "1. Play Kiki-Jiki\n2. Play Restoration Angel\n3. Tap Kiki-Jiki to copy Angel\n4. Copy flickers Kiki-Jiki (untapping it)\n5. Repeat for infinite hasty Angels",
    category: 'infinite_tokens'
  },
  {
    name: "Painter's Servant + Grindstone",
    cards: ["Painter's Servant", 'Grindstone'],
    result_tag: "Mill entire library",
    color_identity: [],
    steps: "1. Play Painter's Servant naming any color\n2. Play Grindstone\n3. Activate Grindstone targeting opponent\n4. All cards share a color, mill entire library",
    category: 'infinite_mill'
  },
  {
    name: "Time Warp + Archaeomancer",
    cards: ['Time Warp', 'Archaeomancer', 'Conjurer\'s Closet'],
    result_tag: "Infinite turns",
    color_identity: ['U'],
    steps: "1. Play Time Warp for extra turn\n2. Play Archaeomancer, return Time Warp\n3. Play Conjurer's Closet\n4. Each end step, flicker Archaeomancer\n5. Keep returning Time Warp",
    category: 'infinite_turns'
  },
  {
    name: "Flash + Protean Hulk",
    cards: ['Flash', 'Protean Hulk', 'Viscera Seer', 'Karmic Guide'],
    result_tag: "Instant win combo",
    color_identity: ['U', 'W', 'B'],
    steps: "1. Flash in Protean Hulk\n2. Let it die to Flash\n3. Get Viscera Seer + Karmic Guide + others\n4. Loop creatures for instant win",
    category: 'instant_win'
  },
  {
    name: "Laboratory Maniac Win",
    cards: ['Laboratory Maniac', 'Demonic Consultation', 'Tainted Pact'],
    result_tag: "Win with empty library",
    color_identity: ['U', 'B'],
    steps: "1. Play Laboratory Maniac\n2. Cast Demonic Consultation naming card not in deck\n3. Exile entire library\n4. Draw a card to win",
    category: 'instant_win'
  },
  {
    name: "Stasis Lock",
    cards: ['Stasis', 'Chronatog', 'Kismet'],
    result_tag: "Game lock",
    color_identity: ['U', 'W'],
    steps: "1. Play Stasis to stop untap steps\n2. Use Chronatog to skip turns and keep Stasis\n3. Kismet makes opponent's lands enter tapped\n4. Opponent can't play spells",
    category: 'prison_lock'
  },
  {
    name: "ANT Storm",
    cards: ['Ad Nauseam', 'Tendrils of Agony', 'Dark Ritual', 'Cabal Ritual'],
    result_tag: "Storm kill",
    color_identity: ['B'],
    steps: "1. Build mana with Dark/Cabal Ritual\n2. Cast Ad Nauseam to draw deck\n3. Chain more rituals for storm count\n4. Tendrils for 20+ damage",
    category: 'storm_combo'
  },
  {
    name: "High Tide Storm",
    cards: ['High Tide', 'Time Spiral', 'Brain Freeze', 'Merchant Scroll'],
    result_tag: "Storm mill/win",
    color_identity: ['U'],
    steps: "1. Cast High Tide for mana\n2. Chain cantrips and Time Spiral\n3. Build storm count\n4. Brain Freeze to mill or Tendrils to kill",
    category: 'storm_combo'
  },
  {
    name: "Infect Combo",
    cards: ['Glistener Elf', 'Invigorate', 'Berserk', 'Might of Old Krosa'],
    result_tag: "One-shot poison kill",
    color_identity: ['G'],
    steps: "1. Play Glistener Elf turn 1\n2. Turn 2: Invigorate (+4/+4), Berserk (double power)\n3. Might of Old Krosa (+2/+2)\n4. Attack for 10+ poison counters",
    category: 'aggro_combo'
  },
  {
    name: "Show and Tell",
    cards: ['Show and Tell', 'Omniscience', 'Emrakul, the Aeons Torn'],
    result_tag: "Fast big threats",
    color_identity: ['U'],
    steps: "1. Turn 3 Show and Tell\n2. Put Omniscience into play\n3. Cast anything for free\n4. Drop Emrakul or other game-enders",
    category: 'ramp_combo'
  },
  {
    name: "Devoted Druid + Vizier of Remedies",
    cards: ['Devoted Druid', 'Vizier of Remedies'],
    result_tag: "Infinite green mana",
    color_identity: ['G', 'W'],
    steps: "1. Play both creatures\n2. Tap Druid for G mana\n3. Put -1/-1 counter to untap (prevented by Vizier)\n4. Tap again for infinite mana",
    category: 'creature_combo'
  },
  {
    name: "Thopter Foundry Engine",
    cards: ['Thopter Foundry', 'Sword of the Meek', 'Time Sieve'],
    result_tag: "Infinite thopters and turns",
    color_identity: ['U', 'W', 'B'],
    steps: "1. Sacrifice Sword to Foundry for thopter + life\n2. Sword returns when thopter enters\n3. Time Sieve takes extra turns\n4. Repeat for infinite thopters/turns",
    category: 'artifact_combo'
  },
  {
    name: "Scapeshift Combo",
    cards: ['Scapeshift', 'Valakut, the Molten Pinnacle', 'Mountain'],
    result_tag: "Land-based damage",
    color_identity: ['R', 'G'],
    steps: "1. Get 7+ lands in play\n2. Cast Scapeshift sacrificing 7 lands\n3. Get Valakut + 6 Mountains\n4. 18+ damage from Valakut triggers",
    category: 'land_combo'
  },
  {
    name: "Mikaeus Combo",
    cards: ['Mikaeus, the Unhallowed', 'Triskelion', 'Phyrexian Altar'],
    result_tag: "Infinite damage",
    color_identity: ['B'],
    steps: "1. Play Mikaeus and Triskelion\n2. Remove counters to damage Triskelion\n3. Triskelion dies and returns with undying\n4. Repeat for infinite damage",
    category: 'creature_combo'
  },
  {
    name: "Food Chain Combo",
    cards: ['Food Chain', 'Eternal Scourge', 'Misthollow Griffin'],
    result_tag: "Infinite colored mana",
    color_identity: ['G'],
    steps: "1. Play Food Chain\n2. Exile creature for mana\n3. Cast from exile for net mana\n4. Infinite colored mana for creatures",
    category: 'infinite_mana'
  },
  {
    name: "Tinker Combo",
    cards: ['Tinker', 'Blightsteel Colossus', 'Darksteel Colossus'],
    result_tag: "Fast artifact threat",
    color_identity: ['U'],
    steps: "1. Play cheap artifact\n2. Tinker sacrificing it\n3. Get Blightsteel Colossus\n4. One-shot kill with infect",
    category: 'ramp_combo'
  },
  {
    name: "Cauldron Familiar Loop",
    cards: ['Cauldron Familiar', 'Witch\'s Oven', 'Trail of Crumbs'],
    result_tag: "Incremental damage engine",
    color_identity: ['B', 'G'],
    steps: "1. Sacrifice Familiar to Oven for food\n2. Sacrifice food to return Familiar\n3. Each loop drains 1 life\n4. Trail provides card selection",
    category: 'value_engine'
  }
]

interface SeedingResult {
  success: boolean
  message: string
  stats?: {
    combos_created: number
    cards_created: number
    relationships_created: number
  }
  errors?: string[]
  log?: string[]
}

export async function POST(request: NextRequest): Promise<NextResponse<SeedingResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    log.push('Starting combo database seeding...')
    
    // Verifica admin key
    const body = await request.json()
    const adminKey = body.adminKey || request.headers.get('x-admin-key')
    
    if (adminKey !== config.admin.key) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }

    // Setup Supabase client
    const supabase = createClient(config.supabase.url, config.supabase.serviceKey)
    log.push('Supabase client initialized')

    // Clean existing data
    log.push('Cleaning existing combo data...')
    
    const { error: comboCardsError } = await supabase
      .from('combo_cards')
      .delete()
      .neq('combo_id', '00000000-0000-0000-0000-000000000000')

    if (comboCardsError) {
      errors.push(`Warning cleaning combo_cards: ${comboCardsError.message}`)
    }

    const { error: combosError } = await supabase
      .from('combos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (combosError) {
      errors.push(`Warning cleaning combos: ${combosError.message}`)
    }

    log.push('Existing combo data cleaned')

    // Seed combos
    let combosCreated = 0
    let cardsCreated = 0
    let relationshipsCreated = 0

    for (let i = 0; i < FAMOUS_COMBOS.length; i++) {
      const combo = FAMOUS_COMBOS[i]
      
      try {
        // Create combo record
        const comboId = `combo_${i.toString().padStart(3, '0')}`
        
        const { error: comboError } = await supabase
          .from('combos')
          .insert({
            id: comboId,
            source: 'manual_curated',
            name: combo.name,
            result_tag: combo.result_tag,
            color_identity: combo.color_identity,
            links: [],
            steps: combo.steps
          })

        if (comboError) {
          errors.push(`Error inserting combo ${combo.name}: ${comboError.message}`)
          continue
        }

        combosCreated++

        // Process cards
        const cardIds: string[] = []
        
        for (const cardName of combo.cards) {
          const cardId = await findOrCreateCard(supabase, cardName, combo.color_identity, log)
          if (cardId) {
            cardIds.push(cardId)
          }
        }

        // Create relationships
        if (cardIds.length > 0) {
          const comboCardRows = cardIds.map(cardId => ({
            combo_id: comboId,
            card_id: cardId
          }))

          const { error: relationshipError } = await supabase
            .from('combo_cards')
            .insert(comboCardRows)

          if (relationshipError) {
            errors.push(`Error creating relationships for ${combo.name}: ${relationshipError.message}`)
          } else {
            relationshipsCreated += cardIds.length
            log.push(`✅ ${combo.name} (${cardIds.length} cards)`)
          }
        }

      } catch (error) {
        errors.push(`Unexpected error with combo ${combo.name}: ${(error as Error).message}`)
      }
    }

    // Final statistics
    const { count: finalComboCount } = await supabase
      .from('combos')
      .select('*', { count: 'exact', head: true })

    const { count: finalCardCount } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })

    const { count: finalRelationshipCount } = await supabase
      .from('combo_cards')
      .select('*', { count: 'exact', head: true })

    log.push('Seeding completed successfully!')
    log.push(`Final stats: ${finalComboCount} combos, ${finalCardCount} cards, ${finalRelationshipCount} relationships`)

    return NextResponse.json({
      success: true,
      message: 'Combo database seeding completed successfully',
      stats: {
        combos_created: combosCreated,
        cards_created: cardsCreated,
        relationships_created: relationshipsCreated
      },
      errors: errors.length > 0 ? errors : undefined,
      log
    })

  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`❌ Seeding failed: ${errorMessage}`)

    return NextResponse.json({
      success: false,
      message: 'Seeding failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function findOrCreateCard(
  supabase: any, 
  cardName: string, 
  comboColors: string[] = [],
  log: string[]
): Promise<string | null> {
  
  try {
    // Try to find existing card
    const { data: existingCards, error: searchError } = await supabase
      .from('cards')
      .select('id')
      .ilike('name', cardName)
      .limit(1)

    if (searchError) {
      log.push(`Search error for card ${cardName}: ${searchError.message}`)
      return null
    }

    if (existingCards && existingCards.length > 0) {
      return existingCards[0].id
    }

    // Create placeholder card
    log.push(`🔍 Creating placeholder for: ${cardName}`)
    
    const { data: newCard, error: insertError } = await supabase
      .from('cards')
      .insert({
        scryfall_id: `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: cardName,
        mana_value: estimateManaCost(cardName),
        colors: estimateColors(cardName, comboColors),
        color_identity: comboColors,
        types: estimateTypes(cardName),
        oracle_text: `Placeholder for ${cardName} - will be updated by Scryfall sync`,
        legal_standard: false,
        legal_historic: true,
        legal_brawl: false,
        in_arena: false,
        tags: ['placeholder', 'combo_card']
      })
      .select('id')
      .single()

    if (insertError) {
      log.push(`❌ Error creating placeholder for ${cardName}: ${insertError.message}`)
      return null
    }

    return newCard.id

  } catch (error) {
    log.push(`❌ Unexpected error finding/creating card ${cardName}: ${(error as Error).message}`)
    return null
  }
}

function estimateManaCost(cardName: string): number {
  const name = cardName.toLowerCase()
  
  if (name.includes('emrakul') || name.includes('blightsteel')) return 15
  if (name.includes('omniscience')) return 10
  if (name.includes('time warp')) return 5
  if (name.includes('titan')) return 6
  if (name.includes('bolt') || name.includes('ritual')) return 1
  
  return 3
}

function estimateColors(cardName: string, comboColors: string[]): string[] {
  const name = cardName.toLowerCase()
  const colors: string[] = []
  
  if (name.includes('lightning bolt')) colors.push('R')
  if (name.includes('dark ritual')) colors.push('B')
  if (name.includes('counterspell')) colors.push('U')
  
  if (colors.length === 0 && comboColors.length > 0) {
    colors.push(...comboColors)
  }
  
  return [...new Set(colors)]
}

function estimateTypes(cardName: string): string[] {
  const name = cardName.toLowerCase()
  
  if (name.includes('titan') || name.includes('angel') || name.includes('demon')) {
    return ['Creature']
  }
  if (name.includes('bolt') || name.includes('ritual')) {
    return ['Instant', 'Sorcery']
  }
  if (name.includes('ring') || name.includes('monolith')) {
    return ['Artifact']
  }
  if (name.includes('bond') || name.includes('blood')) {
    return ['Enchantment']
  }
  
  return ['Unknown']
}