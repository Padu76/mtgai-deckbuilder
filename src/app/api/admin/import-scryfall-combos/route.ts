// src/app/api/admin/import-scryfall-combos/route.ts
// Fixed Scryfall integration con controlli di sicurezza per proprietà undefined

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
  },
  admin: {
    key: process.env.NEXT_PUBLIC_ADMIN_KEY!
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Controllo sicurezza per proprietà carte
function isValidCard(card: any): card is ScryFallCard {
  return (
    card &&
    typeof card.id === 'string' &&
    typeof card.name === 'string' &&
    typeof card.oracle_text === 'string' &&
    typeof card.type_line === 'string' &&
    card.legalities &&
    typeof card.legalities === 'object'
  )
}

// Safe accessor per testo oracle
function getSafeOracleText(card: any): string {
  if (!card || typeof card.oracle_text !== 'string') {
    return ''
  }
  return card.oracle_text
}

// Safe accessor per type line
function getSafeTypeLine(card: any): string {
  if (!card || typeof card.type_line !== 'string') {
    return ''
  }
  return card.type_line
}

// Safe accessor per nome carta
function getSafeName(card: any): string {
  if (!card || typeof card.name !== 'string') {
    return 'Unknown Card'
  }
  return card.name
}

// Carte con combo noti che cercare su Scryfall per relazioni
const COMBO_SEED_CARDS = [
  'Heliod, Sun-Crowned',
  'Walking Ballista',
  'Nexus of Fate',
  'Teferi, Hero of Dominaria',
  'Cauldron Familiar',
  'Witch\'s Oven',
  'Aetherflux Reservoir',
  'Saheeli Rai',
  'Felidar Guardian',
  'Kinnan, Bonder Prodigy',
  'Basalt Monolith',
  'Karn, the Great Creator',
  'Mycosynth Lattice',
  'Muxus, Goblin Grandee',
  'Krenko, Mob Boss',
  'Omnath, Locus of Creation',
  'Scute Swarm',
  'Wilderness Reclamation',
  'Jeskai Ascendancy',
  'Collected Company'
]

interface ScryFallCard {
  id: string
  name: string
  mana_cost?: string
  cmc?: number
  colors?: string[]
  color_identity?: string[]
  type_line: string
  oracle_text: string
  legalities: {
    standard?: string
    historic?: string
    brawl?: string
  }
  set?: string
  rarity?: string
  image_uris?: {
    normal?: string
    small?: string
  }
  keywords?: string[]
  produced_mana?: string[]
  arena_id?: number
  games?: string[]
}

interface ImportResult {
  success: boolean
  message: string
  stats?: {
    cards_fetched: number
    combo_patterns_found: number
    combos_created: number
    existing_combos_updated: number
  }
  errors?: string[]
  log?: string[]
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    log.push('Starting Scryfall combo integration...')
    
    const body = await request.json()
    const adminKey = body.adminKey || request.headers.get('x-admin-key')
    const maxCards = body.maxCards || 200
    
    if (adminKey !== config.admin.key) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }

    const supabase = createClient(config.supabase.url, config.supabase.serviceKey)
    log.push('Supabase client initialized')

    // Step 1: Fetch Arena cards from Scryfall
    log.push('Fetching Arena cards from Scryfall...')
    const arenaCards = await fetchArenaCardsFromScryfall(log, maxCards)
    log.push(`Fetched ${arenaCards.length} Arena cards from Scryfall`)

    // Step 2: Analyze for combo patterns (con controlli di sicurezza)
    log.push('Analyzing cards for combo patterns...')
    const comboPatterns = analyzeComboPatterns(arenaCards, log, errors)
    log.push(`Found ${comboPatterns.length} potential combo patterns`)

    // Step 3: Create combos in database
    log.push('Creating combo records in database...')
    const combosCreated = await createCombosFromPatterns(supabase, comboPatterns, log, errors)

    // Step 4: Update existing cards with Scryfall data
    log.push('Updating existing cards with Scryfall data...')
    const cardsUpdated = await updateExistingCards(supabase, arenaCards, log)

    const stats = {
      cards_fetched: arenaCards.length,
      combo_patterns_found: comboPatterns.length,
      combos_created: combosCreated,
      existing_combos_updated: cardsUpdated
    }

    log.push('Scryfall combo integration completed successfully!')
    log.push(`Created ${combosCreated} new combos from Scryfall analysis`)
    log.push(`Updated ${cardsUpdated} existing cards with Scryfall data`)

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed ${arenaCards.length} Arena cards and created ${combosCreated} combos`,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      log
    })

  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`Scryfall integration failed: ${errorMessage}`)

    return NextResponse.json({
      success: false,
      message: 'Scryfall combo integration failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function fetchArenaCardsFromScryfall(log: string[], maxCards: number): Promise<ScryFallCard[]> {
  const allCards: ScryFallCard[] = []
  let page = 1
  
  try {
    // Query Scryfall per carte Arena con testo combo-relevant
    const comboQuery = `game:arena (oracle:"infinite" OR oracle:"combo" OR oracle:"enters the battlefield" OR oracle:"dies" OR oracle:"sacrifice" OR oracle:"untap")`
    
    while (allCards.length < maxCards) {
      const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(comboQuery)}&page=${page}&format=json`
      
      log.push(`Fetching Scryfall page ${page}...`)
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MTGArenaAI-DeckBuilder/1.0'
        }
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          log.push('No more cards found, ending search')
          break
        }
        throw new Error(`Scryfall API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.data || data.data.length === 0) {
        log.push('No more cards in response, ending search')
        break
      }
      
      // Filter for valid Arena cards con controlli di sicurezza
      const arenaCards = data.data.filter((card: any) => {
        if (!isValidCard(card)) {
          log.push(`Skipped invalid card: ${getSafeName(card)}`)
          return false
        }
        
        const hasArenaGame = card.games && Array.isArray(card.games) && card.games.includes('arena')
        const isLegal = (
          (card.legalities.historic && card.legalities.historic === 'legal') ||
          (card.legalities.standard && card.legalities.standard === 'legal')
        )
        
        return hasArenaGame && isLegal
      })
      
      log.push(`Filtered ${arenaCards.length} valid Arena cards from page ${page}`)
      allCards.push(...arenaCards)
      
      if (!data.has_more) {
        log.push('Reached last page of results')
        break
      }
      
      page++
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (page > 10) { // Safety limit
        log.push('Reached page limit, stopping')
        break
      }
    }
    
  } catch (error) {
    log.push(`Error fetching from Scryfall: ${(error as Error).message}`)
    
    // Fallback: fetch specific combo seed cards
    log.push('Falling back to fetching specific combo cards...')
    for (const cardName of COMBO_SEED_CARDS.slice(0, 10)) {
      try {
        const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`)
        if (response.ok) {
          const card = await response.json()
          if (isValidCard(card) && card.games && card.games.includes('arena')) {
            allCards.push(card)
            log.push(`Added fallback card: ${card.name}`)
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (err) {
        log.push(`Failed to fetch ${cardName}: ${(err as Error).message}`)
      }
    }
  }
  
  return allCards.slice(0, maxCards)
}

function analyzeComboPatterns(cards: ScryFallCard[], log: string[], errors: string[]): ComboPattern[] {
  const patterns: ComboPattern[] = []
  
  try {
    log.push(`Starting pattern analysis on ${cards.length} valid cards`)
    
    // Look for known combo pairs
    const knownPairs = [
      ['Heliod, Sun-Crowned', 'Walking Ballista'],
      ['Saheeli Rai', 'Felidar Guardian'], 
      ['Cauldron Familiar', 'Witch\'s Oven'],
      ['Kinnan, Bonder Prodigy', 'Basalt Monolith'],
      ['Karn, the Great Creator', 'Mycosynth Lattice']
    ]
    
    for (const [card1Name, card2Name] of knownPairs) {
      try {
        const card1 = cards.find(c => getSafeName(c) === card1Name)
        const card2 = cards.find(c => getSafeName(c) === card2Name)
        
        if (card1 && card2) {
          patterns.push({
            cards: [card1, card2],
            type: 'known_combo',
            confidence: 0.9,
            description: `${card1Name} + ${card2Name} combo`
          })
          log.push(`Found known combo: ${card1Name} + ${card2Name}`)
        }
      } catch (err) {
        errors.push(`Error analyzing known pair ${card1Name}/${card2Name}: ${(err as Error).message}`)
      }
    }
    
    // Look for cards with infinite potential (con controlli sicurezza)
    const infiniteCards = cards.filter(card => {
      try {
        const oracleText = getSafeOracleText(card).toLowerCase()
        return (
          oracleText.includes('infinite') ||
          oracleText.includes('any number of times')
        )
      } catch (err) {
        errors.push(`Error checking infinite text for ${getSafeName(card)}: ${(err as Error).message}`)
        return false
      }
    })
    
    log.push(`Found ${infiniteCards.length} cards with infinite potential`)
    
    for (const infiniteCard of infiniteCards) {
      try {
        // Find enablers for infinite cards
        const enablers = cards.filter(card => {
          try {
            if (card.id === infiniteCard.id) return false
            
            const oracleText = getSafeOracleText(card).toLowerCase()
            return (
              oracleText.includes('untap') ||
              oracleText.includes('return') ||
              oracleText.includes('enters the battlefield')
            )
          } catch (err) {
            errors.push(`Error checking enabler for ${getSafeName(card)}: ${(err as Error).message}`)
            return false
          }
        })
        
        for (const enabler of enablers.slice(0, 3)) { // Limit to avoid too many combinations
          try {
            if (hasComboSynergy(infiniteCard, enabler, errors)) {
              patterns.push({
                cards: [infiniteCard, enabler],
                type: 'infinite_synergy',
                confidence: 0.6,
                description: `${getSafeName(infiniteCard)} synergy with ${getSafeName(enabler)}`
              })
            }
          } catch (err) {
            errors.push(`Error creating synergy pattern: ${(err as Error).message}`)
          }
        }
      } catch (err) {
        errors.push(`Error processing infinite card ${getSafeName(infiniteCard)}: ${(err as Error).message}`)
      }
    }
    
    // Look for tribal/thematic synergies
    try {
      const tribalSynergies = findTribalSynergies(cards, log, errors)
      patterns.push(...tribalSynergies)
    } catch (err) {
      errors.push(`Error finding tribal synergies: ${(err as Error).message}`)
    }
    
    log.push(`Pattern analysis complete: ${patterns.length} patterns found`)
    
  } catch (err) {
    errors.push(`Critical error in pattern analysis: ${(err as Error).message}`)
    log.push(`Pattern analysis failed with critical error`)
  }
  
  return patterns.filter(p => p.confidence > 0.5).slice(0, 50) // Keep only confident patterns
}

interface ComboPattern {
  cards: ScryFallCard[]
  type: string
  confidence: number
  description: string
}

function hasComboSynergy(card1: ScryFallCard, card2: ScryFallCard, errors: string[]): boolean {
  try {
    const text1 = getSafeOracleText(card1).toLowerCase()
    const text2 = getSafeOracleText(card2).toLowerCase()
    
    // Check for keyword interactions
    const interactions = [
      ['artifact', 'artifact'],
      ['creature', 'enters the battlefield'],
      ['sacrifice', 'dies'],
      ['untap', 'tap'],
      ['counter', 'counter'],
      ['draw', 'discard'],
      ['life', 'damage']
    ]
    
    for (const [keyword1, keyword2] of interactions) {
      if (text1.includes(keyword1) && text2.includes(keyword2)) {
        return true
      }
    }
    
    return false
  } catch (err) {
    errors.push(`Error checking synergy between ${getSafeName(card1)} and ${getSafeName(card2)}: ${(err as Error).message}`)
    return false
  }
}

function findTribalSynergies(cards: ScryFallCard[], log: string[], errors: string[]): ComboPattern[] {
  const patterns: ComboPattern[] = []
  
  try {
    const tribes = ['goblin', 'elf', 'vampire', 'zombie', 'angel', 'dragon']
    
    for (const tribe of tribes) {
      try {
        const tribalCards = cards.filter(card => {
          try {
            const typeLine = getSafeTypeLine(card).toLowerCase()
            const oracleText = getSafeOracleText(card).toLowerCase()
            return (
              typeLine.includes(tribe) ||
              oracleText.includes(tribe)
            )
          } catch (err) {
            errors.push(`Error filtering ${tribe} for ${getSafeName(card)}: ${(err as Error).message}`)
            return false
          }
        })
        
        if (tribalCards.length >= 2) {
          // Create tribal combo pattern
          const lordCards = tribalCards.filter(card => {
            try {
              const oracleText = getSafeOracleText(card).toLowerCase()
              return (
                oracleText.includes('other ' + tribe) ||
                oracleText.includes(tribe + 's get')
              )
            } catch (err) {
              return false
            }
          })
          
          const tokenCards = tribalCards.filter(card => {
            try {
              const oracleText = getSafeOracleText(card).toLowerCase()
              return (
                oracleText.includes('create') &&
                oracleText.includes(tribe)
              )
            } catch (err) {
              return false
            }
          })
          
          for (const lord of lordCards) {
            for (const tokenMaker of tokenCards) {
              if (lord.id !== tokenMaker.id) {
                patterns.push({
                  cards: [lord, tokenMaker],
                  type: 'tribal_synergy',
                  confidence: 0.7,
                  description: `${tribe.charAt(0).toUpperCase() + tribe.slice(1)} tribal synergy`
                })
              }
            }
          }
        }
      } catch (err) {
        errors.push(`Error processing ${tribe} tribal synergies: ${(err as Error).message}`)
      }
    }
    
    log.push(`Found ${patterns.length} tribal synergy patterns`)
    
  } catch (err) {
    errors.push(`Critical error in tribal synergy analysis: ${(err as Error).message}`)
  }
  
  return patterns
}

async function createCombosFromPatterns(
  supabase: any, 
  patterns: ComboPattern[], 
  log: string[], 
  errors: string[]
): Promise<number> {
  let combosCreated = 0
  
  for (const pattern of patterns) {
    try {
      // Check if combo already exists
      const cardNames = pattern.cards.map(c => getSafeName(c))
      
      if (cardNames.some(name => !name || name === 'Unknown Card')) {
        errors.push(`Skipped pattern with invalid card names: ${cardNames.join(', ')}`)
        continue
      }
      
      const { data: existingCombo } = await supabase
        .from('combos')
        .select('id')
        .ilike('name', `%${cardNames[0]}%`)
        .ilike('name', `%${cardNames[1]}%`)
        .limit(1)
      
      if (existingCombo && existingCombo.length > 0) {
        continue // Skip if combo already exists
      }
      
      // Create new combo
      const comboId = generateUUID()
      const comboName = cardNames.join(' + ')
      
      const { error: comboError } = await supabase
        .from('combos')
        .insert({
          id: comboId,
          source: 'scryfall_analysis',
          name: comboName,
          result_tag: pattern.description,
          color_identity: getComboColors(pattern.cards),
          links: [`https://scryfall.com/search?q=${encodeURIComponent(cardNames.join(' OR '))}`],
          steps: generateComboSteps(pattern)
        })
      
      if (comboError) {
        errors.push(`Error creating combo ${comboName}: ${comboError.message}`)
        continue
      }
      
      // Create card relationships
      const cardIds: string[] = []
      
      for (const card of pattern.cards) {
        const cardId = await findOrCreateCardFromScryfall(supabase, card, log, errors)
        if (cardId) {
          cardIds.push(cardId)
        }
      }
      
      if (cardIds.length > 0) {
        const comboCardRows = cardIds.map(cardId => ({
          combo_id: comboId,
          card_id: cardId
        }))
        
        await supabase.from('combo_cards').insert(comboCardRows)
        combosCreated++
        log.push(`Created: ${comboName}`)
      }
      
    } catch (error) {
      errors.push(`Error processing pattern: ${(error as Error).message}`)
    }
  }
  
  return combosCreated
}

async function updateExistingCards(
  supabase: any,
  scryfallCards: ScryFallCard[],
  log: string[]
): Promise<number> {
  let cardsUpdated = 0
  
  for (const scryfallCard of scryfallCards.slice(0, 50)) { // Limit to avoid timeout
    try {
      if (!isValidCard(scryfallCard)) {
        continue
      }
      
      const { data: existingCard } = await supabase
        .from('cards')
        .select('id, name, oracle_text')
        .ilike('name', getSafeName(scryfallCard))
        .limit(1)
      
      if (existingCard && existingCard.length > 0) {
        const card = existingCard[0]
        
        // Update with Scryfall data if it's a placeholder
        if (card.oracle_text && card.oracle_text.includes('Placeholder')) {
          const { error: updateError } = await supabase
            .from('cards')
            .update({
              scryfall_id: scryfallCard.id,
              oracle_text: scryfallCard.oracle_text,
              mana_value: scryfallCard.cmc || 0,
              mana_cost: scryfallCard.mana_cost || '',
              colors: scryfallCard.colors || [],
              color_identity: scryfallCard.color_identity || [],
              types: getSafeTypeLine(scryfallCard).split(' — ').filter(t => t.trim()),
              image_url: scryfallCard.image_uris?.normal || '',
              tags: ['scryfall_updated', 'combo_card']
            })
            .eq('id', card.id)
          
          if (!updateError) {
            cardsUpdated++
          }
        }
      }
      
    } catch (error) {
      // Skip cards that can't be updated
    }
  }
  
  return cardsUpdated
}

async function findOrCreateCardFromScryfall(
  supabase: any,
  scryfallCard: ScryFallCard,
  log: string[],
  errors: string[]
): Promise<string | null> {
  try {
    if (!isValidCard(scryfallCard)) {
      errors.push(`Invalid card data for: ${getSafeName(scryfallCard)}`)
      return null
    }
    
    // Try to find existing card
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .ilike('name', getSafeName(scryfallCard))
      .limit(1)
    
    if (existingCards && existingCards.length > 0) {
      return existingCards[0].id
    }
    
    // Create new card from Scryfall data
    const cardId = generateUUID()
    
    const { data: newCard, error: insertError } = await supabase
      .from('cards')
      .insert({
        id: cardId,
        scryfall_id: scryfallCard.id,
        name: getSafeName(scryfallCard),
        mana_value: scryfallCard.cmc || 0,
        mana_cost: scryfallCard.mana_cost || '',
        colors: scryfallCard.colors || [],
        color_identity: scryfallCard.color_identity || [],
        types: getSafeTypeLine(scryfallCard).split(' — ').filter(t => t.trim()),
        oracle_text: getSafeOracleText(scryfallCard),
        legal_standard: scryfallCard.legalities?.standard === 'legal',
        legal_historic: scryfallCard.legalities?.historic === 'legal',
        legal_brawl: scryfallCard.legalities?.brawl === 'legal',
        in_arena: true,
        image_url: scryfallCard.image_uris?.normal || '',
        tags: ['scryfall_import', 'combo_card']
      })
      .select('id')
      .single()
    
    if (insertError) {
      errors.push(`Error creating card ${getSafeName(scryfallCard)}: ${insertError.message}`)
      return null
    }
    
    return cardId
    
  } catch (error) {
    errors.push(`Error processing card ${getSafeName(scryfallCard)}: ${(error as Error).message}`)
    return null
  }
}

function getComboColors(cards: ScryFallCard[]): string[] {
  const allColors = new Set<string>()
  
  for (const card of cards) {
    try {
      const colors = card.color_identity || []
      for (const color of colors) {
        if (typeof color === 'string') {
          allColors.add(color)
        }
      }
    } catch (err) {
      // Skip cards with invalid color data
    }
  }
  
  return Array.from(allColors)
}

function generateComboSteps(pattern: ComboPattern): string {
  const cardNames = pattern.cards.map(c => getSafeName(c))
  
  switch (pattern.type) {
    case 'known_combo':
      return `Known combo interaction between ${cardNames.join(' and ')}`
    case 'infinite_synergy':
      return `1. Play ${cardNames[0]}\n2. Play ${cardNames[1]}\n3. Use their abilities in combination\n4. Potential for infinite loop`
    case 'tribal_synergy':
      return `1. Deploy tribal creatures\n2. Use lords and token makers together\n3. Build overwhelming board presence`
    default:
      return `Synergy combo using ${cardNames.join(' + ')}`
  }
}