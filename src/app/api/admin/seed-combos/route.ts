// src/app/api/admin/seed-combos/route.ts
// API endpoint per seeding completo del database combo - UUID FIXATO

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Configurazione inline per evitare dipendenze da @/lib/config
const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
  },
  admin: {
    key: process.env.NEXT_PUBLIC_ADMIN_KEY!
  }
}

// Funzione per generare UUID validi
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Database completo con 50+ combo famose categorizzate
const FAMOUS_COMBOS = [
  // === INFINITE DAMAGE ===
  {
    name: "Exquisite Blood + Sanguine Bond",
    cards: ['Exquisite Blood', 'Sanguine Bond'],
    result_tag: "Infinite damage",
    color_identity: ['W', 'B'],
    steps: "1. Play both enchantments\n2. Gain any amount of life\n3. Sanguine Bond deals damage\n4. Exquisite Blood gains life\n5. Infinite loop kills all opponents",
    category: 'infinite_damage'
  },
  {
    name: "Aetherflux Reservoir Storm",
    cards: ['Aetherflux Reservoir', 'Tendrils of Agony', 'Dark Ritual'],
    result_tag: "Storm win condition", 
    color_identity: ['B'],
    steps: "1. Build storm count with cheap spells\n2. Play Aetherflux Reservoir\n3. Continue storm to gain life\n4. Activate Reservoir for 50 damage",
    category: 'storm_combo'
  },
  {
    name: "Splinter Twin + Deceiver Exarch",
    cards: ['Splinter Twin', 'Deceiver Exarch'],
    result_tag: "Infinite hasty creatures",
    color_identity: ['U', 'R'],
    steps: "1. Play Deceiver Exarch\n2. Enchant with Splinter Twin\n3. Tap to create copy\n4. Copy untaps original\n5. Repeat for infinite hasty attackers",
    category: 'infinite_tokens'
  },

  // === INFINITE MANA ===
  {
    name: "Basalt Monolith + Rings of Brighthearth",
    cards: ['Basalt Monolith', 'Rings of Brighthearth'],
    result_tag: "Infinite colorless mana",
    color_identity: [],
    steps: "1. Play both artifacts\n2. Tap Monolith for 3 mana\n3. Pay 3 to untap Monolith\n4. Pay 2 to copy ability with Rings\n5. Net +1 mana per loop",
    category: 'infinite_mana'
  },
  {
    name: "Palinchron + High Tide",
    cards: ['Palinchron', 'High Tide'],
    result_tag: "Infinite mana",
    color_identity: ['U'],
    steps: "1. Cast High Tide\n2. Play Palinchron\n3. Untap 7 islands for 14+ mana\n4. Return and recast Palinchron\n5. Net positive mana each loop",
    category: 'infinite_mana'
  },
  {
    name: "Grim Monolith + Power Artifact",
    cards: ['Grim Monolith', 'Power Artifact'],
    result_tag: "Infinite colorless mana",
    color_identity: ['U'],
    steps: "1. Enchant Grim Monolith with Power Artifact\n2. Tap for 3 mana\n3. Pay 2 to untap (reduced from 4)\n4. Net +1 mana per activation",
    category: 'infinite_mana'
  },

  // === INFINITE TOKENS ===
  {
    name: "Kiki-Jiki + Restoration Angel",
    cards: ['Kiki-Jiki, Mirror Breaker', 'Restoration Angel'],
    result_tag: "Infinite hasty tokens",
    color_identity: ['R', 'W'],
    steps: "1. Play Kiki-Jiki\n2. Play Restoration Angel\n3. Tap Kiki-Jiki to copy Angel\n4. Copy flickers Kiki-Jiki (untapping it)\n5. Repeat for infinite hasty Angels",
    category: 'infinite_tokens'
  },
  {
    name: "Midnight Guard + Presence of Gond",
    cards: ['Midnight Guard', 'Presence of Gond'],
    result_tag: "Infinite elf tokens",
    color_identity: ['W', 'G'],
    steps: "1. Enchant Midnight Guard with Presence of Gond\n2. Tap Guard to create Elf token\n3. Token entering untaps Guard\n4. Repeat for infinite tokens",
    category: 'infinite_tokens'
  },
  {
    name: "Krenko Mob Boss Engine",
    cards: ['Krenko, Mob Boss', 'Skirk Prospector', 'Goblin Chieftain'],
    result_tag: "Exponential goblin tokens",
    color_identity: ['R'],
    steps: "1. Play Krenko and supporting goblins\n2. Tap Krenko to double goblin count\n3. Use haste enablers to repeat\n4. Exponential token growth",
    category: 'token_engine'
  },

  // === INFINITE MILL ===
  {
    name: "Painter's Servant + Grindstone",
    cards: ["Painter's Servant", 'Grindstone'],
    result_tag: "Mill entire library",
    color_identity: [],
    steps: "1. Play Painter's Servant naming any color\n2. Play Grindstone\n3. Activate Grindstone targeting opponent\n4. All cards share a color, mill entire library",
    category: 'infinite_mill'
  },
  {
    name: "Phenax Mill Engine",
    cards: ['Phenax, God of Deception', 'Eater of the Dead', 'Undead Alchemist'],
    result_tag: "Mass mill engine",
    color_identity: ['U', 'B'],
    steps: "1. Play Phenax and creatures\n2. Tap creatures to mill\n3. Eater untaps when creatures hit graveyards\n4. Alchemist makes zombies from milled humans",
    category: 'mill_engine'
  },
  {
    name: "Altar of Dementia Loops",
    cards: ['Altar of Dementia', 'Reveillark', 'Body Double', 'Karmic Guide'],
    result_tag: "Infinite mill combo",
    color_identity: ['W', 'U'],
    steps: "1. Mill Karmic Guide with Altar\n2. Reveillark dies, returns Guide + Body Double\n3. Body Double copies Reveillark\n4. Repeat for infinite mill",
    category: 'infinite_mill'
  },

  // === INFINITE TURNS ===
  {
    name: "Time Warp + Archaeomancer",
    cards: ['Time Warp', 'Archaeomancer', 'Conjurer\'s Closet'],
    result_tag: "Infinite turns",
    color_identity: ['U'],
    steps: "1. Play Time Warp for extra turn\n2. Play Archaeomancer, return Time Warp\n3. Play Conjurer's Closet\n4. Each end step, flicker Archaeomancer\n5. Keep returning Time Warp",
    category: 'infinite_turns'
  },
  {
    name: "Nexus of Fate Engine",
    cards: ['Nexus of Fate', 'Teferi, Hero of Dominaria'],
    result_tag: "Infinite turns",
    color_identity: ['U', 'W'],
    steps: "1. Cast Nexus of Fate for extra turn\n2. +1 Teferi to return Nexus to library\n3. Draw Nexus again\n4. Repeat for infinite turns",
    category: 'infinite_turns'
  },
  {
    name: "Sage of Hours Combo",
    cards: ['Sage of Hours', 'Vorel of the Hull Clade', 'Doubling Season'],
    result_tag: "Extra turns combo",
    color_identity: ['U', 'G'],
    steps: "1. Play Sage of Hours with counters\n2. Double counters with Vorel/Season\n3. Remove 5 counters for extra turn\n4. Repeat with counter doubling",
    category: 'turns_combo'
  },

  // === INSTANT WIN ===
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
    name: "Thassa's Oracle Win",
    cards: ["Thassa's Oracle", 'Demonic Consultation', 'Tainted Pact'],
    result_tag: "Oracle instant win",
    color_identity: ['U', 'B'],
    steps: "1. Cast Demonic Consultation exiling library\n2. Cast Thassa's Oracle with empty library\n3. Oracle trigger wins immediately\n4. More reliable than Lab Man",
    category: 'instant_win'
  },

  // === STAX/PRISON ===
  {
    name: "Stasis Lock",
    cards: ['Stasis', 'Chronatog', 'Kismet'],
    result_tag: "Game lock",
    color_identity: ['U', 'W'],
    steps: "1. Play Stasis to stop untap steps\n2. Use Chronatog to skip turns and keep Stasis\n3. Kismet makes opponent's lands enter tapped\n4. Opponent can't play spells",
    category: 'prison_lock'
  },
  {
    name: "Knowledge Pool Lock",
    cards: ['Knowledge Pool', 'Teferi, Time Raveler'],
    result_tag: "Spell lock",
    color_identity: ['U', 'W'],
    steps: "1. Play Teferi, Time Raveler\n2. Play Knowledge Pool\n3. Opponents can only cast sorceries as instants\n4. But Teferi prevents instant-speed spells\n5. Opponents can't cast anything",
    category: 'prison_lock'
  },
  {
    name: "Trinisphere Prison",
    cards: ['Trinisphere', 'Chalice of the Void', 'Thorn of Amethyst'],
    result_tag: "Mana denial prison",
    color_identity: [],
    steps: "1. Deploy multiple cost-increasing effects\n2. Lock opponents out of cheap spells\n3. Chalice on 0 and 1 stops acceleration\n4. Win through incremental damage",
    category: 'prison_lock'
  },

  // === STORM COMBOS ===
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
    name: "Eggs Storm",
    cards: ['Krark-Clan Ironworks', 'Chromatic Sphere', 'Second Sunrise', 'Faith\'s Reward'],
    result_tag: "Artifact storm",
    color_identity: ['W'],
    steps: "1. Sacrifice artifacts for mana and cards\n2. Return all artifacts with Sunrise/Reward\n3. Build storm count with cheap artifacts\n4. Win with Grapeshot or Tendrils",
    category: 'artifact_storm'
  },

  // === AGGRO COMBOS ===
  {
    name: "Infect Combo",
    cards: ['Glistener Elf', 'Invigorate', 'Berserk', 'Might of Old Krosa'],
    result_tag: "One-shot poison kill",
    color_identity: ['G'],
    steps: "1. Play Glistener Elf turn 1\n2. Turn 2: Invigorate (+4/+4), Berserk (double power)\n3. Might of Old Krosa (+2/+2)\n4. Attack for 10+ poison counters",
    category: 'aggro_combo'
  },
  {
    name: "Prowess Storm",
    cards: ['Monastery Swiftspear', 'Lava Spike', 'Lightning Bolt', 'Rift Bolt'],
    result_tag: "Fast aggro kill",
    color_identity: ['R'],
    steps: "1. Turn 1 Monastery Swiftspear\n2. Turn 2+ chain cheap spells\n3. Prowess triggers make huge creature\n4. Combined with burn spells for quick kill",
    category: 'aggro_combo'
  },
  {
    name: "Kiln Fiend Combo",
    cards: ['Kiln Fiend', 'Temur Battle Rage', 'Mutagenic Growth', 'Assault Strobe'],
    result_tag: "One-shot combo kill",
    color_identity: ['R', 'G'],
    steps: "1. Play Kiln Fiend\n2. Cast multiple pump spells (triggers +3/+0 each)\n3. Grant double strike\n4. One-shot kill with massive damage",
    category: 'aggro_combo'
  },

  // === RAMP COMBOS ===
  {
    name: "Show and Tell",
    cards: ['Show and Tell', 'Omniscience', 'Emrakul, the Aeons Torn'],
    result_tag: "Fast big threats",
    color_identity: ['U'],
    steps: "1. Turn 3 Show and Tell\n2. Put Omniscience into play\n3. Cast anything for free\n4. Drop Emrakul or other game-enders",
    category: 'ramp_combo'
  },
  {
    name: "Sneak Attack",
    cards: ['Sneak Attack', 'Emrakul, the Aeons Torn', 'Griselbrand'],
    result_tag: "Fast reanimator",
    color_identity: ['R'],
    steps: "1. Play Sneak Attack\n2. Pay R to put massive creature into play\n3. Attack immediately\n4. Sacrifice at end of turn but damage is done",
    category: 'ramp_combo'
  },
  {
    name: "Natural Order",
    cards: ['Natural Order', 'Progenitus', 'Craterhoof Behemoth', 'Dryad Arbor'],
    result_tag: "Fast creature ramp",
    color_identity: ['G'],
    steps: "1. Turn 1 Dryad Arbor\n2. Turn 3 Natural Order sacrificing arbor\n3. Get Craterhoof or Progenitus\n4. Immediate huge threat",
    category: 'ramp_combo'
  },

  // === CREATURE COMBOS ===
  {
    name: "Devoted Druid + Vizier of Remedies",
    cards: ['Devoted Druid', 'Vizier of Remedies'],
    result_tag: "Infinite green mana",
    color_identity: ['G', 'W'],
    steps: "1. Play both creatures\n2. Tap Druid for G mana\n3. Put -1/-1 counter to untap (prevented by Vizier)\n4. Tap again for infinite mana",
    category: 'creature_combo'
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
    name: "Anafenza Combo",
    cards: ['Anafenza, Kin-Tree Spirit', 'Murderous Redcap', 'Viscera Seer'],
    result_tag: "Infinite damage combo",
    color_identity: ['W', 'B', 'R'],
    steps: "1. Play Anafenza and sacrifice outlet\n2. Play Redcap, gets +1/+1 from Anafenza\n3. Sacrifice Redcap, persists with no counters\n4. Repeat for infinite damage",
    category: 'creature_combo'
  },

  // === ARTIFACT COMBOS ===
  {
    name: "Thopter Foundry Engine",
    cards: ['Thopter Foundry', 'Sword of the Meek', 'Time Sieve'],
    result_tag: "Infinite thopters and turns",
    color_identity: ['U', 'W', 'B'],
    steps: "1. Sacrifice Sword to Foundry for thopter + life\n2. Sword returns when thopter enters\n3. Time Sieve takes extra turns\n4. Repeat for infinite thopters/turns",
    category: 'artifact_combo'
  },
  {
    name: "KCI Eggs",
    cards: ['Krark-Clan Ironworks', 'Myr Retriever', 'Workshop Assistant', 'Junk Diver'],
    result_tag: "Infinite mana/artifacts",
    color_identity: [],
    steps: "1. Sacrifice artifacts to KCI for mana\n2. Use death triggers to return artifacts\n3. Replay for net positive mana\n4. Infinite mana and artifacts",
    category: 'artifact_combo'
  },
  {
    name: "Paradox Engine Storm",
    cards: ['Paradox Engine', 'Sol Ring', 'Sensei\'s Divining Top', 'Aetherflux Reservoir'],
    result_tag: "Artifact storm",
    color_identity: [],
    steps: "1. Play Paradox Engine and mana rocks\n2. Cast cheap spells to untap artifacts\n3. Generate more mana than spent\n4. Build storm for Reservoir win",
    category: 'artifact_storm'
  },

  // === LAND COMBOS ===
  {
    name: "Scapeshift Combo",
    cards: ['Scapeshift', 'Valakut, the Molten Pinnacle', 'Mountain'],
    result_tag: "Land-based damage",
    color_identity: ['R', 'G'],
    steps: "1. Get 7+ lands in play\n2. Cast Scapeshift sacrificing 7 lands\n3. Get Valakut + 6 Mountains\n4. 18+ damage from Valakut triggers",
    category: 'land_combo'
  },
  {
    name: "Amulet Titan",
    cards: ['Amulet of Vigor', 'Primeval Titan', 'Tolaria West', 'Simic Growth Chamber'],
    result_tag: "Fast ramp combo",
    color_identity: ['G', 'U'],
    steps: "1. Play Amulet of Vigor\n2. Play bounce lands for multiple mana\n3. Turn 2-3 Primeval Titan\n4. Get utility lands and pressure",
    category: 'ramp_combo'
  },
  {
    name: "Dark Depths Combo",
    cards: ['Dark Depths', 'Thespian\'s Stage', 'Vampire Hexmage'],
    result_tag: "20/20 flying indestructible",
    color_identity: ['B'],
    steps: "1. Copy Dark Depths with Stage\n2. Stage enters with no counters\n3. Immediately gets Marit Lage token\n4. 20/20 flying indestructible threat",
    category: 'land_combo'
  },

  // === MANA DENIAL ===
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

  // === HISTORIC/ARENA COMBOS ===
  {
    name: "Cauldron Familiar Loop",
    cards: ['Cauldron Familiar', 'Witch\'s Oven', 'Trail of Crumbs'],
    result_tag: "Incremental damage engine",
    color_identity: ['B', 'G'],
    steps: "1. Sacrifice Familiar to Oven for food\n2. Sacrifice food to return Familiar\n3. Each loop drains 1 life\n4. Trail provides card selection",
    category: 'value_engine'
  },
  {
    name: "Wilderness Reclamation Combo",
    cards: ['Wilderness Reclamation', 'Nexus of Fate', 'Growth Spiral'],
    result_tag: "Extra turns engine",
    color_identity: ['U', 'G'],
    steps: "1. Play Wilderness Reclamation\n2. Cast spells on opponent's turn\n3. Use extra mana for Nexus of Fate\n4. Take infinite turns with card draw",
    category: 'turns_combo'
  },

  // === VALUE ENGINES ===
  {
    name: "Pauper Tron",
    cards: ['Ghostly Flicker', 'Archaeomancer', 'Mnemonic Wall', 'Mulldrifter'],
    result_tag: "Value engine",
    color_identity: ['U'],
    steps: "1. Loop Ghostly Flicker with Archaeomancer\n2. Flicker value creatures each turn\n3. Draw extra cards and gain tempo\n4. Win through incremental advantage",
    category: 'value_engine'
  },
  {
    name: "Birthing Pod Chain",
    cards: ['Birthing Pod', 'Kitchen Finks', 'Murderous Redcap', 'Reveillark'],
    result_tag: "Creature value engine",
    color_identity: ['G', 'W', 'B'],
    steps: "1. Use Pod to chain up creature costs\n2. Get value from enters/leaves triggers\n3. End with powerful finishers\n4. Incremental advantage and board control",
    category: 'value_engine'
  }
]

interface SeedingStats {
  combos_created: number
  cards_created: number
  relationships_created: number
  total_combos: number
  total_cards: number
  total_relationships: number
}

interface SeedingResult {
  success: boolean
  message: string
  stats?: SeedingStats
  errors?: string[]
  log?: string[]
}

export async function POST(request: NextRequest): Promise<NextResponse<SeedingResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    log.push('Starting enhanced combo database seeding...')
    log.push(`Preparing to seed ${FAMOUS_COMBOS.length} curated combos`)
    
    // Verifica admin key
    const body = await request.json()
    const adminKey = body.adminKey || request.headers.get('x-admin-key')
    
    if (adminKey !== config.admin.key) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }

    // Setup Supabase client con service role per write access
    const supabase = createClient(config.supabase.url, config.supabase.serviceKey)
    log.push('Supabase client initialized with service role key')

    // Clean existing data
    log.push('Cleaning existing combo data...')
    
    const { error: comboCardsError } = await supabase
      .from('combo_cards')
      .delete()
      .neq('combo_id', '00000000-0000-0000-0000-000000000000')

    if (comboCardsError) {
      errors.push(`Warning cleaning combo_cards: ${comboCardsError.message}`)
    } else {
      log.push('Combo relationships cleaned successfully')
    }

    const { error: combosError } = await supabase
      .from('combos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (combosError) {
      errors.push(`Warning cleaning combos: ${combosError.message}`)
    } else {
      log.push('Existing combos cleaned successfully')
    }

    // Seed combos with proper error handling e UUID CORRETTI
    let combosCreated = 0
    let cardsCreated = 0
    let relationshipsCreated = 0

    for (let i = 0; i < FAMOUS_COMBOS.length; i++) {
      const combo = FAMOUS_COMBOS[i]
      
      try {
        // Create combo record con UUID VALIDO
        const comboId = generateUUID()
        
        const { error: comboError } = await supabase
          .from('combos')
          .insert({
            id: comboId,
            source: 'manual_curated_v3',
            name: combo.name,
            result_tag: combo.result_tag,
            color_identity: combo.color_identity,
            links: [], // Future: add links to external resources
            steps: combo.steps
          })

        if (comboError) {
          errors.push(`Error inserting combo ${combo.name}: ${comboError.message}`)
          continue
        }

        combosCreated++
        log.push(`✓ Combo inserted: ${combo.name}`)

        // Process each card in the combo
        const cardIds: string[] = []
        
        for (const cardName of combo.cards) {
          const cardId = await findOrCreateCard(supabase, cardName, combo.color_identity, log)
          if (cardId) {
            cardIds.push(cardId)
          }
        }

        // Create combo-card relationships
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
            log.push(`✓ ${combo.name} linked with ${cardIds.length} cards - Category: ${combo.category}`)
          }
        } else {
          log.push(`⚠ ${combo.name} has no valid cards linked`)
        }

        // Rate limiting every 15 combos
        if (i > 0 && i % 15 === 0) {
          log.push(`⏳ Progress: ${i + 1}/${FAMOUS_COMBOS.length} combos processed...`)
          await new Promise(resolve => setTimeout(resolve, 800))
        }

      } catch (error) {
        errors.push(`Unexpected error with combo ${combo.name}: ${(error as Error).message}`)
        log.push(`❌ Failed processing: ${combo.name}`)
      }
    }

    // Final statistics
    const [comboCount, cardCount, relationshipCount] = await Promise.all([
      supabase.from('combos').select('*', { count: 'exact', head: true }),
      supabase.from('cards').select('*', { count: 'exact', head: true }),
      supabase.from('combo_cards').select('*', { count: 'exact', head: true })
    ])

    log.push('Enhanced combo seeding completed successfully!')
    log.push('Database now ready for combo searches and AI analysis')
    log.push(`Final statistics:`)
    log.push(`  • ${comboCount.count || 0} total combos in database`)
    log.push(`  • ${cardCount.count || 0} total cards in database`)
    log.push(`  • ${relationshipCount.count || 0} total card relationships`)
    log.push(`Categories seeded: infinite_damage, infinite_mana, infinite_tokens, storm_combo, aggro_combo, and more`)

    return NextResponse.json({
      success: true,
      message: 'Enhanced combo database seeding completed successfully',
      stats: {
        combos_created: combosCreated,
        cards_created: cardsCreated,
        relationships_created: relationshipsCreated,
        total_combos: comboCount.count || 0,
        total_cards: cardCount.count || 0,
        total_relationships: relationshipCount.count || 0
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
      message: 'Enhanced seeding failed',
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
    // Try to find existing card by exact name match
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

    // Card doesn't exist, create enhanced placeholder con UUID VALIDO
    const cardId = generateUUID()
    const timestamp = Date.now()
    
    const { data: newCard, error: insertError } = await supabase
      .from('cards')
      .insert({
        id: cardId,
        scryfall_id: `placeholder_${timestamp}_${cardName.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: cardName,
        mana_value: estimateManaCost(cardName),
        colors: estimateColors(cardName, comboColors),
        color_identity: comboColors,
        types: estimateTypes(cardName),
        oracle_text: `${cardName} - Placeholder card for combo seeding. Will be updated when Scryfall sync runs.`,
        legal_standard: estimateFormat(cardName, 'standard'),
        legal_historic: estimateFormat(cardName, 'historic'),
        legal_brawl: estimateFormat(cardName, 'brawl'),
        in_arena: estimateArenaLegal(cardName),
        tags: ['placeholder', 'combo_card', 'needs_scryfall_update']
      })
      .select('id')
      .single()

    if (insertError) {
      log.push(`❌ Error creating placeholder for ${cardName}: ${insertError.message}`)
      return null
    }

    log.push(`🔍 Created placeholder: ${cardName}`)
    cardsCreated++
    return cardId

  } catch (error) {
    log.push(`❌ Unexpected error finding/creating card ${cardName}: ${(error as Error).message}`)
    return null
  }
}

// Enhanced estimation functions with better card recognition
function estimateManaCost(cardName: string): number {
  const name = cardName.toLowerCase()
  
  // Expensive cards (10+)
  if (name.includes('emrakul') || name.includes('blightsteel') || name.includes('darksteel colossus')) return 15
  if (name.includes('omniscience') || name.includes('enter the infinite')) return 10
  if (name.includes('progenitus')) return 10
  
  // High cost (6-9)
  if (name.includes('time warp') || name.includes('nexus of fate')) return 5
  if (name.includes('primeval titan') || name.includes('craterhoof') || name.includes('griselbrand')) return 6
  if (name.includes('show and tell')) return 3
  if (name.includes('tinker')) return 4
  
  // Medium cost (3-5)
  if (name.includes('high tide')) return 1
  if (name.includes('palinchron')) return 7
  if (name.includes('archaeomancer') || name.includes('mnemonic wall')) return 4
  if (name.includes('deceiver exarch') || name.includes('restoration angel')) return 4
  if (name.includes('splinter twin')) return 4
  
  // Low cost (1-2)  
  if (name.includes('lightning bolt') || name.includes('lava spike')) return 1
  if (name.includes('dark ritual') || name.includes('cabal ritual')) return 1
  if (name.includes('glistener elf') || name.includes('monastery swiftspear')) return 1
  if (name.includes('invigorate') || name.includes('mutagenic growth')) return 0
  
  // Artifacts typically cost 2-4
  if (name.includes('monolith') || name.includes('rings')) return 3
  if (name.includes('grindstone')) return 1
  if (name.includes('sword of the meek')) return 2
  
  return 3 // Default reasonable estimate
}

function estimateColors(cardName: string, comboColors: string[]): string[] {
  const name = cardName.toLowerCase()
  const colors: string[] = []
  
  // Specific well-known cards
  if (name.includes('lightning bolt') || name.includes('lava spike')) colors.push('R')
  if (name.includes('dark ritual') || name.includes('cabal ritual') || name.includes('tendrils')) colors.push('B')
  if (name.includes('counterspell') || name.includes('high tide') || name.includes('time warp')) colors.push('U')
  if (name.includes('swords to plowshares') || name.includes('restoration angel')) colors.push('W')
  if (name.includes('giant growth') || name.includes('might of') || name.includes('invigorate')) colors.push('G')
  
  // Color indicators in names
  if (name.includes('white') || name.includes('serra') || name.includes('sanguine')) colors.push('W')
  if (name.includes('blue') || name.includes('sapphire') || name.includes('ancestral')) colors.push('U')
  if (name.includes('black') || name.includes('demonic') || name.includes('exquisite')) colors.push('B')
  if (name.includes('red') || name.includes('kiki-jiki') || name.includes('sneak')) colors.push('R')
  if (name.includes('green') || name.includes('natural order') || name.includes('devoted druid')) colors.push('G')
  
  // Multi-color indicators
  if (name.includes('simic') || name.includes('amulet')) colors.push('U', 'G')
  if (name.includes('orzhov')) colors.push('W', 'B')
  if (name.includes('izzet') || name.includes('twin')) colors.push('U', 'R')
  
  // Fall back to combo colors if nothing specific found
  if (colors.length === 0 && comboColors.length > 0) {
    colors.push(...comboColors.slice(0, 2)) // Limit to 2 colors for individual cards
  }
  
  return [...new Set(colors)]
}

function estimateTypes(cardName: string): string[] {
  const name = cardName.toLowerCase()
  const types: string[] = []
  
  // Creatures
  if (name.includes('titan') || name.includes('angel') || name.includes('demon') || name.includes('dragon') ||
      name.includes('elf') || name.includes('human') || name.includes('swiftspear') || name.includes('guard') ||
      name.includes('druid') || name.includes('exarch') || name.includes('archaeomancer') || 
      name.includes('familiar') || name.includes('servant')) {
    types.push('Creature')
  }
  
  // Instants/Sorceries
  if (name.includes('bolt') || name.includes('spike') || name.includes('ritual') || name.includes('warp') ||
      name.includes('consultation') || name.includes('pact') || name.includes('show and tell') ||
      name.includes('tinker') || name.includes('scapeshift') || name.includes('order')) {
    types.push(name.includes('bolt') || name.includes('ritual') ? 'Instant' : 'Sorcery')
  }
  
  // Artifacts
  if (name.includes('monolith') || name.includes('rings') || name.includes('grindstone') || 
      name.includes('sword') || name.includes('foundry') || name.includes('reservoir') ||
      name.includes('oven') || name.includes('sieve') || name.includes('altar')) {
    types.push('Artifact')
  }
  
  // Enchantments
  if (name.includes('blood') || name.includes('bond') || name.includes('presence') || name.includes('twin') ||
      name.includes('stasis') || name.includes('pool') || name.includes('chain') || name.includes('attack')) {
    types.push('Enchantment')
  }
  
  // Planeswalkers
  if (name.includes('teferi') || name.includes('jace')) {
    types.push('Planeswalker')
  }
  
  // Lands
  if (name.includes('depths') || name.includes('valakut') || name.includes('stage') || name.includes('chamber')) {
    types.push('Land')
  }
  
  if (types.length === 0) {
    types.push('Unknown')
  }
  
  return types
}

function estimateFormat(cardName: string, format: string): boolean {
  const name = cardName.toLowerCase()
  
  // Cards definitely not in Standard
  if (format === 'standard') {
    const vintageOnlyCards = ['ancestral recall', 'black lotus', 'time walk', 'mox', 'power nine']
    if (vintageOnlyCards.some(card => name.includes(card))) return false
    
    // Most combo pieces are not Standard legal
    return name.includes('familiar') || name.includes('oven') || name.includes('reservoir')
  }
  
  // Historic is more inclusive
  if (format === 'historic') {
    return !name.includes('black lotus') && !name.includes('ancestral recall')
  }
  
  // Brawl has similar restrictions to Standard but singleton
  if (format === 'brawl') {
    return estimateFormat(cardName, 'standard')
  }
  
  return true
}

function estimateArenaLegal(cardName: string): boolean {
  const name = cardName.toLowerCase()
  
  // Definitely not in Arena
  const notInArena = [
    'black lotus', 'ancestral recall', 'time walk', 'mox', 
    'painter', 'grindstone', 'flash', 'protean hulk',
    'show and tell', 'sneak attack', 'natural order'
  ]
  
  if (notInArena.some(card => name.includes(card))) return false
  
  // Likely in Arena (Historic cards)
  const likelyInArena = [
    'familiar', 'oven', 'reservoir', 'nexus', 'teferi',
    'lightning bolt', 'dark ritual'
  ]
  
  return likelyInArena.some(card => name.includes(card))
}