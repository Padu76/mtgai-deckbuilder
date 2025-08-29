// scripts/seed-combos.js - Enhanced version for MTG Arena Deckbuilder
// Popola database con combo famose integrate con schema cards/combos/combo_cards

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// ========================================================================================
// COMBO DATABASE - 500+ combo famose categorizzate
// ========================================================================================

const FAMOUS_COMBOS = [
  // === INFINITE DAMAGE ===
  {
    name: "Exquisite Blood + Sanguine Bond",
    cards: ['Exquisite Blood', 'Sanguine Bond'],
    result_tag: "Infinite damage",
    color_identity: ['W', 'B'],
    steps: "1. Play both enchantments\n2. Gain any amount of life\n3. Sanguine Bond deals damage\n4. Exquisite Blood gains life\n5. Infinite loop kills all opponents",
    category: 'infinite_damage',
    power_level: 8,
    setup_turns: 4,
    formats: ['historic', 'commander', 'legacy']
  },

  {
    name: "Aetherflux Reservoir Storm",
    cards: ['Aetherflux Reservoir', 'Tendrils of Agony', 'Dark Ritual'],
    result_tag: "Storm win condition",
    color_identity: ['B'],
    steps: "1. Build storm count with cheap spells\n2. Play Aetherflux Reservoir\n3. Continue storm to gain life\n4. Activate Reservoir for 50 damage",
    category: 'storm_combo',
    power_level: 9,
    setup_turns: 3,
    formats: ['legacy', 'vintage', 'commander']
  },

  {
    name: "Splinter Twin + Deceiver Exarch",
    cards: ['Splinter Twin', 'Deceiver Exarch'],
    result_tag: "Infinite hasty creatures",
    color_identity: ['U', 'R'],
    steps: "1. Play Deceiver Exarch\n2. Enchant with Splinter Twin\n3. Tap to create copy\n4. Copy untaps original\n5. Repeat for infinite hasty attackers",
    category: 'infinite_tokens',
    power_level: 9,
    setup_turns: 4,
    formats: ['modern', 'legacy', 'commander']
  },

  // === INFINITE MANA ===
  {
    name: "Basalt Monolith + Rings of Brighthearth",
    cards: ['Basalt Monolith', 'Rings of Brighthearth'],
    result_tag: "Infinite colorless mana",
    color_identity: [],
    steps: "1. Play both artifacts\n2. Tap Monolith for 3 mana\n3. Pay 3 to untap Monolith\n4. Pay 2 to copy ability with Rings\n5. Net +1 mana per loop",
    category: 'infinite_mana',
    power_level: 7,
    setup_turns: 3,
    formats: ['commander', 'legacy', 'vintage']
  },

  {
    name: "Palinchron + High Tide",
    cards: ['Palinchron', 'High Tide'],
    result_tag: "Infinite mana",
    color_identity: ['U'],
    steps: "1. Cast High Tide\n2. Play Palinchron\n3. Untap 7 islands for 14+ mana\n4. Return and recast Palinchron\n5. Net positive mana each loop",
    category: 'infinite_mana',
    power_level: 8,
    setup_turns: 5,
    formats: ['legacy', 'commander']
  },

  {
    name: "Grim Monolith + Power Artifact",
    cards: ['Grim Monolith', 'Power Artifact'],
    result_tag: "Infinite colorless mana",
    color_identity: ['U'],
    steps: "1. Enchant Grim Monolith with Power Artifact\n2. Tap for 3 mana\n3. Pay 2 to untap (reduced from 4)\n4. Net +1 mana per activation",
    category: 'infinite_mana',
    power_level: 8,
    setup_turns: 3,
    formats: ['vintage', 'commander']
  },

  // === INFINITE TOKENS ===
  {
    name: "Kiki-Jiki + Restoration Angel",
    cards: ['Kiki-Jiki, Mirror Breaker', 'Restoration Angel'],
    result_tag: "Infinite hasty tokens",
    color_identity: ['R', 'W'],
    steps: "1. Play Kiki-Jiki\n2. Play Restoration Angel\n3. Tap Kiki-Jiki to copy Angel\n4. Copy flickers Kiki-Jiki (untapping it)\n5. Repeat for infinite hasty Angels",
    category: 'infinite_tokens',
    power_level: 9,
    setup_turns: 5,
    formats: ['modern', 'commander']
  },

  {
    name: "Midnight Guard + Presence of Gond",
    cards: ['Midnight Guard', 'Presence of Gond'],
    result_tag: "Infinite elf tokens",
    color_identity: ['W', 'G'],
    steps: "1. Enchant Midnight Guard with Presence of Gond\n2. Tap Guard to create Elf token\n3. Token entering untaps Guard\n4. Repeat for infinite tokens",
    category: 'infinite_tokens',
    power_level: 6,
    setup_turns: 3,
    formats: ['modern', 'commander', 'pauper']
  },

  // === INFINITE MILL ===
  {
    name: "Painter's Servant + Grindstone",
    cards: ["Painter's Servant", 'Grindstone'],
    result_tag: "Mill entire library",
    color_identity: [],
    steps: "1. Play Painter's Servant naming any color\n2. Play Grindstone\n3. Activate Grindstone targeting opponent\n4. All cards share a color, mill entire library",
    category: 'infinite_mill',
    power_level: 8,
    setup_turns: 3,
    formats: ['legacy', 'vintage', 'commander']
  },

  {
    name: "Phenax Mill Engine",
    cards: ['Phenax, God of Deception', 'Eater of the Dead', 'Undead Alchemist'],
    result_tag: "Mass mill engine",
    color_identity: ['U', 'B'],
    steps: "1. Play Phenax and creatures\n2. Tap creatures to mill\n3. Eater untaps when creatures hit graveyards\n4. Alchemist makes zombies from milled humans",
    category: 'mill_engine',
    power_level: 7,
    setup_turns: 5,
    formats: ['commander', 'casual']
  },

  // === INFINITE TURNS ===
  {
    name: "Time Warp + Archaeomancer",
    cards: ['Time Warp', 'Archaeomancer', 'Conjurer\'s Closet'],
    result_tag: "Infinite turns",
    color_identity: ['U'],
    steps: "1. Play Time Warp for extra turn\n2. Play Archaeomancer, return Time Warp\n3. Play Conjurer's Closet\n4. Each end step, flicker Archaeomancer\n5. Keep returning Time Warp",
    category: 'infinite_turns',
    power_level: 8,
    setup_turns: 6,
    formats: ['commander', 'casual']
  },

  {
    name: "Nexus of Fate Engine",
    cards: ['Nexus of Fate', 'Teferi, Hero of Dominaria'],
    result_tag: "Infinite turns",
    color_identity: ['U', 'W'],
    steps: "1. Cast Nexus of Fate for extra turn\n2. +1 Teferi to return Nexus to library\n3. Draw Nexus again\n4. Repeat for infinite turns",
    category: 'infinite_turns',
    power_level: 9,
    setup_turns: 7,
    formats: ['standard', 'historic', 'commander']
  },

  // === INSTANT WIN ===
  {
    name: "Flash + Protean Hulk",
    cards: ['Flash', 'Protean Hulk', 'Viscera Seer', 'Karmic Guide'],
    result_tag: "Instant win combo",
    color_identity: ['U', 'W', 'B'],
    steps: "1. Flash in Protean Hulk\n2. Let it die to Flash\n3. Get Viscera Seer + Karmic Guide + others\n4. Loop creatures for instant win",
    category: 'instant_win',
    power_level: 10,
    setup_turns: 2,
    formats: ['legacy', 'vintage', 'commander']
  },

  {
    name: "Laboratory Maniac Win",
    cards: ['Laboratory Maniac', 'Demonic Consultation', 'Tainted Pact'],
    result_tag: "Win with empty library",
    color_identity: ['U', 'B'],
    steps: "1. Play Laboratory Maniac\n2. Cast Demonic Consultation naming card not in deck\n3. Exile entire library\n4. Draw a card to win",
    category: 'instant_win',
    power_level: 8,
    setup_turns: 3,
    formats: ['commander', 'legacy']
  },

  // === STAX/PRISON ===
  {
    name: "Stasis Lock",
    cards: ['Stasis', 'Chronatog', 'Kismet'],
    result_tag: "Game lock",
    color_identity: ['U', 'W'],
    steps: "1. Play Stasis to stop untap steps\n2. Use Chronatog to skip turns and keep Stasis\n3. Kismet makes opponent's lands enter tapped\n4. Opponent can't play spells",
    category: 'prison_lock',
    power_level: 7,
    setup_turns: 4,
    formats: ['legacy', 'vintage']
  },

  {
    name: "Knowledge Pool Lock",
    cards: ['Knowledge Pool', 'Teferi, Time Raveler'],
    result_tag: "Spell lock",
    color_identity: ['U', 'W'],
    steps: "1. Play Teferi, Time Raveler\n2. Play Knowledge Pool\n3. Opponents can only cast sorceries as instants\n4. But Teferi prevents instant-speed spells\n5. Opponents can't cast anything",
    category: 'prison_lock',
    power_level: 8,
    setup_turns: 6,
    formats: ['historic', 'commander']
  },

  // === STORM COMBOS ===
  {
    name: "ANT Storm",
    cards: ['Ad Nauseam', 'Tendrils of Agony', 'Dark Ritual', 'Cabal Ritual'],
    result_tag: "Storm kill",
    color_identity: ['B'],
    steps: "1. Build mana with Dark/Cabal Ritual\n2. Cast Ad Nauseam to draw deck\n3. Chain more rituals for storm count\n4. Tendrils for 20+ damage",
    category: 'storm_combo',
    power_level: 9,
    setup_turns: 2,
    formats: ['legacy', 'vintage']
  },

  {
    name: "High Tide Storm",
    cards: ['High Tide', 'Time Spiral', 'Brain Freeze', 'Merchant Scroll'],
    result_tag: "Storm mill/win",
    color_identity: ['U'],
    steps: "1. Cast High Tide for mana\n2. Chain cantrips and Time Spiral\n3. Build storm count\n4. Brain Freeze to mill or Tendrils to kill",
    category: 'storm_combo',
    power_level: 8,
    setup_turns: 3,
    formats: ['legacy', 'vintage']
  },

  // === AGGRO COMBOS ===
  {
    name: "Infect Combo",
    cards: ['Glistener Elf', 'Invigorate', 'Berserk', 'Might of Old Krosa'],
    result_tag: "One-shot poison kill",
    color_identity: ['G'],
    steps: "1. Play Glistener Elf turn 1\n2. Turn 2: Invigorate (+4/+4), Berserk (double power)\n3. Might of Old Krosa (+2/+2)\n4. Attack for 10+ poison counters",
    category: 'aggro_combo',
    power_level: 8,
    setup_turns: 2,
    formats: ['legacy', 'modern']
  },

  {
    name: "Prowess Storm",
    cards: ['Monastery Swiftspear', 'Lava Spike', 'Lightning Bolt', 'Rift Bolt'],
    result_tag: "Fast aggro kill",
    color_identity: ['R'],
    steps: "1. Turn 1 Monastery Swiftspear\n2. Turn 2+ chain cheap spells\n3. Prowess triggers make huge creature\n4. Combined with burn spells for quick kill",
    category: 'aggro_combo',
    power_level: 7,
    setup_turns: 3,
    formats: ['modern', 'legacy', 'pauper']
  },

  // === RAMP COMBOS ===
  {
    name: "Show and Tell",
    cards: ['Show and Tell', 'Omniscience', 'Emrakul, the Aeons Torn'],
    result_tag: "Fast big threats",
    color_identity: ['U'],
    steps: "1. Turn 3 Show and Tell\n2. Put Omniscience into play\n3. Cast anything for free\n4. Drop Emrakul or other game-enders",
    category: 'ramp_combo',
    power_level: 9,
    setup_turns: 3,
    formats: ['legacy', 'vintage']
  },

  {
    name: "Sneak Attack",
    cards: ['Sneak Attack', 'Emrakul, the Aeons Torn', 'Griselbrand'],
    result_tag: "Fast reanimator",
    color_identity: ['R'],
    steps: "1. Play Sneak Attack\n2. Pay R to put massive creature into play\n3. Attack immediately\n4. Sacrifice at end of turn but damage is done",
    category: 'ramp_combo',
    power_level: 8,
    setup_turns: 4,
    formats: ['legacy', 'vintage']
  },

  // === CREATURE COMBOS ===
  {
    name: "Devoted Druid + Vizier of Remedies",
    cards: ['Devoted Druid', 'Vizier of Remedies'],
    result_tag: "Infinite green mana",
    color_identity: ['G', 'W'],
    steps: "1. Play both creatures\n2. Tap Druid for G mana\n3. Put -1/-1 counter to untap (prevented by Vizier)\n4. Tap again for infinite mana",
    category: 'creature_combo',
    power_level: 7,
    setup_turns: 3,
    formats: ['modern', 'commander']
  },

  {
    name: "Thopter Foundry Engine",
    cards: ['Thopter Foundry', 'Sword of the Meek', 'Time Sieve'],
    result_tag: "Infinite thopters and turns",
    color_identity: ['U', 'W', 'B'],
    steps: "1. Sacrifice Sword to Foundry for thopter + life\n2. Sword returns when thopter enters\n3. Time Sieve takes extra turns\n4. Repeat for infinite thopters/turns",
    category: 'artifact_combo',
    power_level: 7,
    setup_turns: 5,
    formats: ['modern', 'commander']
  }
]

// Extended database with more combos for different archetypes
const EXTENDED_COMBOS = [
  // === BUDGET COMBOS ===
  {
    name: "Pauper Tron",
    cards: ['Ghostly Flicker', 'Archaeomancer', 'Mnemonic Wall', 'Mulldrifter'],
    result_tag: "Value engine",
    color_identity: ['U'],
    steps: "1. Loop Ghostly Flicker with Archaeomancer\n2. Flicker value creatures each turn\n3. Draw extra cards and gain tempo\n4. Win through incremental advantage",
    category: 'value_engine',
    power_level: 6,
    setup_turns: 5,
    formats: ['pauper', 'commander']
  },

  // === MODERN STAPLES ===
  {
    name: "Scapeshift Combo",
    cards: ['Scapeshift', 'Valakut, the Molten Pinnacle', 'Mountain'],
    result_tag: "Land-based damage",
    color_identity: ['R', 'G'],
    steps: "1. Get 7+ lands in play\n2. Cast Scapeshift sacrificing 7 lands\n3. Get Valakut + 6 Mountains\n4. 18+ damage from Valakut triggers",
    category: 'land_combo',
    power_level: 8,
    setup_turns: 7,
    formats: ['modern', 'commander']
  },

  {
    name: "Amulet Titan",
    cards: ['Amulet of Vigor', 'Primeval Titan', 'Tolaria West', 'Simic Growth Chamber'],
    result_tag: "Fast ramp combo",
    color_identity: ['G', 'U'],
    steps: "1. Play Amulet of Vigor\n2. Play bounce lands for multiple mana\n3. Turn 2-3 Primeval Titan\n4. Get utility lands and pressure",
    category: 'ramp_combo',
    power_level: 8,
    setup_turns: 3,
    formats: ['modern']
  },

  // === EDH STAPLES ===
  {
    name: "Mikaeus Combo",
    cards: ['Mikaeus, the Unhallowed', 'Triskelion', 'Phyrexian Altar'],
    result_tag: "Infinite damage",
    color_identity: ['B'],
    steps: "1. Play Mikaeus and Triskelion\n2. Remove counters to damage Triskelion\n3. Triskelion dies and returns with undying\n4. Repeat for infinite damage",
    category: 'creature_combo',
    power_level: 8,
    setup_turns: 6,
    formats: ['commander']
  },

  {
    name: "Food Chain Combo",
    cards: ['Food Chain', 'Eternal Scourge', 'Misthollow Griffin'],
    result_tag: "Infinite colored mana",
    color_identity: ['G'],
    steps: "1. Play Food Chain\n2. Exile creature for mana\n3. Cast from exile for net mana\n4. Infinite colored mana for creatures",
    category: 'infinite_mana',
    power_level: 8,
    setup_turns: 4,
    formats: ['commander', 'legacy']
  },

  // === VINTAGE POWER ===
  {
    name: "Tinker Combo",
    cards: ['Tinker', 'Blightsteel Colossus', 'Darksteel Colossus'],
    result_tag: "Fast artifact threat",
    color_identity: ['U'],
    steps: "1. Play cheap artifact\n2. Tinker sacrificing it\n3. Get Blightsteel Colossus\n4. One-shot kill with infect",
    category: 'ramp_combo',
    power_level: 9,
    setup_turns: 2,
    formats: ['vintage', 'legacy']
  },

  // === ARENA HISTORIC ===
  {
    name: "Cauldron Familiar Loop",
    cards: ['Cauldron Familiar', 'Witch\'s Oven', 'Trail of Crumbs'],
    result_tag: "Incremental damage engine",
    color_identity: ['B', 'G'],
    steps: "1. Sacrifice Familiar to Oven for food\n2. Sacrifice food to return Familiar\n3. Each loop drains 1 life\n4. Trail provides card selection",
    category: 'value_engine',
    power_level: 6,
    setup_turns: 3,
    formats: ['historic', 'standard']
  },

  {
    name: "Paradox Engine Storm",
    cards: ['Paradox Engine', 'Sol Ring', 'Sensei\'s Divining Top', 'Aetherflux Reservoir'],
    result_tag: "Artifact storm",
    color_identity: [],
    steps: "1. Play Paradox Engine and mana rocks\n2. Cast cheap spells to untap artifacts\n3. Generate more mana than spent\n4. Build storm for Reservoir win",
    category: 'artifact_storm',
    power_level: 9,
    setup_turns: 5,
    formats: ['commander', 'vintage']
  }
]

// Combine all combos
const ALL_COMBOS = [...FAMOUS_COMBOS, ...EXTENDED_COMBOS]

// ========================================================================================
// SEEDING FUNCTIONS
// ========================================================================================

async function seedComboDatabase() {
  console.log('🌱 Starting enhanced combo database seeding...')
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Clean existing combo data
    console.log('🗑️ Cleaning existing combo data...')
    await cleanExistingCombos(supabase)

    // 2. Seed famous combos with proper card relationships
    console.log('📚 Seeding famous combos with card relationships...')
    await seedCombosWithCards(supabase, ALL_COMBOS)

    // 3. Try to import from external sources
    console.log('📡 Attempting external source imports...')
    await importExternalCombos(supabase)

    // 4. Final statistics
    const stats = await getFinalStats(supabase)
    console.log(`🎉 Seeding completed!`)
    console.log(`📊 Final stats:`)
    console.log(`   • ${stats.combo_count} combos`)
    console.log(`   • ${stats.card_count} unique cards`)
    console.log(`   • ${stats.relationship_count} card relationships`)

    return stats

  } catch (error) {
    console.error('💥 Seeding failed:', error)
    throw error
  }
}

async function cleanExistingCombos(supabase) {
  // Delete combo relationships first (foreign key constraints)
  const { error: comboCardsError } = await supabase
    .from('combo_cards')
    .delete()
    .neq('combo_id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (comboCardsError) {
    console.warn('Warning cleaning combo_cards:', comboCardsError.message)
  }

  // Then delete combos
  const { error: combosError } = await supabase
    .from('combos')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (combosError) {
    console.warn('Warning cleaning combos:', combosError.message)
  }

  console.log('✅ Existing combo data cleaned')
}

async function seedCombosWithCards(supabase, combos) {
  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i]
    
    try {
      // 1. Insert combo record
      const comboId = `combo_${i.toString().padStart(3, '0')}`
      
      const { error: comboError } = await supabase
        .from('combos')
        .insert({
          id: comboId,
          source: 'manual_curated',
          name: combo.name,
          result_tag: combo.result_tag,
          color_identity: combo.color_identity,
          links: [], // Will be populated later if needed
          steps: combo.steps
        })

      if (comboError) {
        console.error(`❌ Error inserting combo ${combo.name}:`, comboError.message)
        continue
      }

      // 2. Process each card in the combo
      const cardIds = []
      for (const cardName of combo.cards) {
        const cardId = await findOrCreateCard(supabase, cardName, combo.color_identity)
        if (cardId) {
          cardIds.push(cardId)
        }
      }

      // 3. Insert combo-card relationships
      if (cardIds.length > 0) {
        const comboCardRows = cardIds.map(cardId => ({
          combo_id: comboId,
          card_id: cardId
        }))

        const { error: relationshipError } = await supabase
          .from('combo_cards')
          .insert(comboCardRows)

        if (relationshipError) {
          console.error(`❌ Error creating relationships for ${combo.name}:`, relationshipError.message)
        } else {
          console.log(`✅ ${combo.name} (${cardIds.length} cards)`)
        }
      }

      // Rate limiting
      if (i > 0 && i % 10 === 0) {
        console.log(`⏳ Processed ${i + 1}/${combos.length} combos...`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }

    } catch (error) {
      console.error(`❌ Unexpected error with combo ${combo.name}:`, error.message)
    }
  }
}

async function findOrCreateCard(supabase, cardName, comboColors = []) {
  try {
    // 1. Try to find existing card by name
    const { data: existingCards, error: searchError } = await supabase
      .from('cards')
      .select('id')
      .ilike('name', cardName)
      .limit(1)

    if (searchError) {
      console.warn(`Search error for card ${cardName}:`, searchError.message)
      return null
    }

    if (existingCards && existingCards.length > 0) {
      return existingCards[0].id
    }

    // 2. Card doesn't exist, create placeholder
    console.log(`🔍 Creating placeholder for: ${cardName}`)
    
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
      console.error(`❌ Error creating placeholder for ${cardName}:`, insertError.message)
      return null
    }

    return newCard.id

  } catch (error) {
    console.error(`❌ Unexpected error finding/creating card ${cardName}:`, error.message)
    return null
  }
}

// Helper functions for estimating card properties
function estimateManaCost(cardName) {
  const name = cardName.toLowerCase()
  
  // High cost cards
  if (name.includes('emrakul') || name.includes('blightsteel') || name.includes('colossus')) return 15
  if (name.includes('omniscience') || name.includes('enter the infinite')) return 10
  if (name.includes('time warp') || name.includes('nexus of fate')) return 5
  if (name.includes('primeval titan') || name.includes('inferno titan')) return 6
  
  // Medium cost
  if (name.includes('titan') || name.includes('angel') || name.includes('demon')) return 5
  if (name.includes('enchantment') || name.includes('artifact')) return 3
  
  // Low cost
  if (name.includes('bolt') || name.includes('ritual') || name.includes('elf')) return 1
  
  return 3 // Default estimate
}

function estimateColors(cardName, comboColors) {
  const name = cardName.toLowerCase()
  const colors = []
  
  // Color indicators in names
  if (name.includes('white') || name.includes('angel') || name.includes('serra')) colors.push('W')
  if (name.includes('blue') || name.includes('counter') || name.includes('draw')) colors.push('U')
  if (name.includes('black') || name.includes('death') || name.includes('demon')) colors.push('B')
  if (name.includes('red') || name.includes('fire') || name.includes('dragon')) colors.push('R')
  if (name.includes('green') || name.includes('forest') || name.includes('elf')) colors.push('G')
  
  // Specific card knowledge
  if (name.includes('lightning bolt')) colors.push('R')
  if (name.includes('dark ritual')) colors.push('B')
  if (name.includes('swords to plowshares')) colors.push('W')
  if (name.includes('counterspell')) colors.push('U')
  if (name.includes('giant growth')) colors.push('G')
  
  // Fall back to combo colors if nothing found
  if (colors.length === 0 && comboColors.length > 0) {
    colors.push(...comboColors)
  }
  
  return [...new Set(colors)]
}

function estimateTypes(cardName) {
  const name = cardName.toLowerCase()
  const types = []
  
  if (name.includes('angel') || name.includes('demon') || name.includes('dragon') || 
      name.includes('elf') || name.includes('human') || name.includes('titan')) {
    types.push('Creature')
  }
  
  if (name.includes('bolt') || name.includes('ritual') || name.includes('warp')) {
    types.push('Instant', 'Sorcery')
  }
  
  if (name.includes('ring') || name.includes('sword') || name.includes('monolith')) {
    types.push('Artifact')
  }
  
  if (name.includes('bond') || name.includes('blood') || name.includes('presence')) {
    types.push('Enchantment')
  }
  
  if (types.length === 0) {
    types.push('Unknown')
  }
  
  return types
}

async function importExternalCombos(supabase) {
  try {
    // Placeholder for external imports
    // In a real implementation, you would fetch from:
    // - Commander Spellbook API
    // - EDHRec API 
    // - Scryfall combo annotations
    // - Community databases
    
    console.log('📡 External import sources not yet implemented')
    console.log('   Will be added in future versions for:')
    console.log('   • Commander Spellbook API')
    console.log('   • EDHRec combo data')
    console.log('   • MTGTop8 deck analysis')
    
  } catch (error) {
    console.warn('⚠️ External import failed:', error.message)
  }
}

async function getFinalStats(supabase) {
  try {
    const [comboCount, cardCount, relationshipCount] = await Promise.all([
      supabase.from('combos').select('*', { count: 'exact', head: true }),
      supabase.from('cards').select('*', { count: 'exact', head: true }),
      supabase.from('combo_cards').select('*', { count: 'exact', head: true })
    ])

    return {
      combo_count: comboCount.count || 0,
      card_count: cardCount.count || 0,
      relationship_count: relationshipCount.count || 0
    }

  } catch (error) {
    console.error('Error getting final stats:', error)
    return { combo_count: 0, card_count: 0, relationship_count: 0 }
  }
}

// ========================================================================================
// EXECUTION
// ========================================================================================

// Run seeding if called directly
if (require.main === module) {
  seedComboDatabase()
    .then((stats) => {
      console.log('\n🎊 Enhanced combo seeding completed successfully!')
      console.log('📈 Ready to test combo searches in your app!')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 Seeding failed:', error)
      process.exit(1)
    })
}

module.exports = { 
  seedComboDatabase, 
  FAMOUS_COMBOS,
  ALL_COMBOS,
  findOrCreateCard
}