// src/app/api/admin/import-scryfall-combos/route.ts
// Aggressive pattern analyzer - Finds more combo interactions

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

// Controlli di sicurezza base
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

function getSafeOracleText(card: any): string {
  if (!card || typeof card.oracle_text !== 'string') return ''
  return card.oracle_text
}

function getSafeTypeLine(card: any): string {
  if (!card || typeof card.type_line !== 'string') return ''
  return card.type_line
}

function getSafeName(card: any): string {
  if (!card || typeof card.name !== 'string') return 'Unknown Card'
  return card.name
}

// Parole chiave espanse per riconoscimento pattern
const COMBO_INDICATORS = {
  infinite: ['infinite', 'any number of times', 'repeatedly', 'loop', 'again and again'],
  triggers: ['when', 'whenever', 'enters the battlefield', 'dies', 'leaves the battlefield'],
  enablers: ['untap', 'return', 'bounce', 'flicker', 'blink', 'sacrifice', 'destroy'],
  payoffs: ['draw', 'damage', 'life', 'tokens', 'counters', 'mill', 'burn'],
  synergy: ['another', 'other', 'each', 'all', 'target', 'choose'],
  value: ['search', 'tutor', 'look', 'reveal', 'exile', 'graveyard'],
  protection: ['hexproof', 'indestructible', 'protection', 'shroud', 'ward'],
  tempo: ['flash', 'instant', 'end of turn', 'beginning', 'upkeep']
}

const MANA_PATTERNS = ['add', 'mana', 'costs less', 'reduce', 'free', 'without paying']
const TRIBAL_TYPES = ['goblin', 'elf', 'vampire', 'zombie', 'angel', 'dragon', 'wizard', 'warrior', 'beast', 'human']
const CARD_TYPES = ['artifact', 'creature', 'enchantment', 'instant', 'sorcery', 'planeswalker']

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
  games?: string[]
}

interface ComboPattern {
  cards: ScryFallCard[]
  type: string
  confidence: number
  description: string
  reasoning: string
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
    log.push('Starting aggressive Scryfall combo analysis...')
    
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

    // Step 1: Fetch diverse Arena cards
    log.push('Fetching diverse Arena cards...')
    const arenaCards = await fetchDiverseArenaCards(log, maxCards)
    log.push(`Fetched ${arenaCards.length} diverse Arena cards`)

    // Step 2: Aggressive pattern analysis
    log.push('Running aggressive pattern analysis...')
    const comboPatterns = await aggressivePatternAnalysis(arenaCards, log, errors)
    log.push(`Found ${comboPatterns.length} potential interactions`)

    // Step 3: Create combos with lower confidence threshold
    log.push('Creating combo records with permissive scoring...')
    const combosCreated = await createCombosFromPatterns(supabase, comboPatterns, log, errors)

    const stats = {
      cards_fetched: arenaCards.length,
      combo_patterns_found: comboPatterns.length,
      combos_created: combosCreated,
      existing_combos_updated: 0
    }

    log.push('Aggressive combo analysis completed!')
    log.push(`Created ${combosCreated} new combos from expanded analysis`)

    return NextResponse.json({
      success: true,
      message: `Analyzed ${arenaCards.length} cards, created ${combosCreated} potential combos`,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      log
    })

  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`Analysis failed: ${errorMessage}`)

    return NextResponse.json({
      success: false,
      message: 'Aggressive combo analysis failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function fetchDiverseArenaCards(log: string[], maxCards: number): Promise<ScryFallCard[]> {
  const allCards: ScryFallCard[] = []
  
  // Multiple query strategies for diversity
  const queries = [
    'game:arena (oracle:"enters the battlefield" OR oracle:"dies" OR oracle:"sacrifice")',
    'game:arena (oracle:"draw" OR oracle:"damage" OR oracle:"life" OR oracle:"token")',
    'game:arena (oracle:"untap" OR oracle:"return" OR oracle:"bounce" OR oracle:"flicker")',
    'game:arena (oracle:"mana" OR oracle:"add" OR oracle:"costs" OR oracle:"reduce")',
    'game:arena (oracle:"search" OR oracle:"tutor" OR oracle:"graveyard" OR oracle:"exile")',
    'game:arena type:creature (oracle:"other" OR oracle:"each" OR oracle:"all")',
    'game:arena type:artifact (oracle:"tap" OR oracle:"activate" OR oracle:"ability")',
    'game:arena (oracle:"whenever" OR oracle:"when" OR oracle:"trigger")'
  ]
  
  for (const [index, query] of queries.entries()) {
    try {
      log.push(`Fetching query ${index + 1}: ${query.substring(0, 50)}...`)
      
      const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&page=1&format=json`, {
        headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
      })
      
      if (!response.ok) continue
      
      const data = await response.json()
      if (!data.data) continue
      
      const validCards = data.data.filter((card: any) => {
        return isValidCard(card) && 
               card.games && 
               card.games.includes('arena') &&
               (card.legalities.historic === 'legal' || card.legalities.standard === 'legal')
      })
      
      // Take first 20-30 from each query for diversity
      allCards.push(...validCards.slice(0, Math.floor(maxCards / queries.length)))
      
      await new Promise(resolve => setTimeout(resolve, 150))
      
      if (allCards.length >= maxCards) break
      
    } catch (error) {
      log.push(`Query ${index + 1} failed: ${(error as Error).message}`)
    }
  }
  
  // Remove duplicates by ID
  const uniqueCards = allCards.filter((card, index, self) => 
    self.findIndex(c => c.id === card.id) === index
  )
  
  return uniqueCards.slice(0, maxCards)
}

async function aggressivePatternAnalysis(cards: ScryFallCard[], log: string[], errors: string[]): Promise<ComboPattern[]> {
  const patterns: ComboPattern[] = []
  
  log.push(`Starting aggressive analysis of ${cards.length} cards...`)
  
  // 1. Analisi carta vs carta per sinergie
  for (let i = 0; i < cards.length && i < 50; i++) {
    for (let j = i + 1; j < cards.length && j < 50; j++) {
      try {
        const synergy = calculateSynergy(cards[i], cards[j])
        if (synergy.score > 0.2) { // Soglia molto bassa
          patterns.push({
            cards: [cards[i], cards[j]],
            type: synergy.type,
            confidence: synergy.score,
            description: synergy.description,
            reasoning: synergy.reasoning
          })
        }
      } catch (err) {
        errors.push(`Error analyzing ${getSafeName(cards[i])} vs ${getSafeName(cards[j])}: ${(err as Error).message}`)
      }
    }
  }
  
  log.push(`Found ${patterns.length} potential 2-card synergies`)
  
  // 2. Analisi tribal avanzata
  const tribalPatterns = findAdvancedTribalSynergies(cards, log)
  patterns.push(...tribalPatterns)
  
  // 3. Analisi engine/payoff
  const enginePatterns = findEnginePayoffPairs(cards, log)
  patterns.push(...enginePatterns)
  
  // 4. Analisi mana/combo
  const manaPatterns = findManaComboSynergies(cards, log)
  patterns.push(...manaPatterns)
  
  log.push(`Total patterns found: ${patterns.length}`)
  
  // Ordina per confidenza e prende i migliori
  return patterns
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 100) // Aumentato limite
}

function calculateSynergy(card1: ScryFallCard, card2: ScryFallCard): {score: number, type: string, description: string, reasoning: string} {
  let score = 0
  const reasons: string[] = []
  let type = 'generic_synergy'
  
  const text1 = getSafeOracleText(card1).toLowerCase()
  const text2 = getSafeOracleText(card2).toLowerCase()
  const type1 = getSafeTypeLine(card1).toLowerCase()
  const type2 = getSafeTypeLine(card2).toLowerCase()
  
  // Analisi trigger/enabler patterns
  if (hasPattern(text1, COMBO_INDICATORS.triggers) && hasPattern(text2, COMBO_INDICATORS.enablers)) {
    score += 0.4
    reasons.push('trigger-enabler interaction')
    type = 'trigger_combo'
  }
  
  if (hasPattern(text1, COMBO_INDICATORS.enablers) && hasPattern(text2, COMBO_INDICATORS.triggers)) {
    score += 0.4
    reasons.push('enabler-trigger interaction')
    type = 'trigger_combo'
  }
  
  // Analisi infinite potential
  if (hasPattern(text1, COMBO_INDICATORS.infinite) || hasPattern(text2, COMBO_INDICATORS.infinite)) {
    score += 0.3
    reasons.push('infinite potential')
    type = 'infinite_combo'
  }
  
  // Analisi same-type synergies
  for (const cardType of CARD_TYPES) {
    if (type1.includes(cardType) && type2.includes(cardType)) {
      score += 0.2
      reasons.push(`both ${cardType}s`)
    }
  }
  
  // Analisi tribal synergies
  for (const tribe of TRIBAL_TYPES) {
    if ((type1.includes(tribe) && text2.includes(tribe)) || 
        (type2.includes(tribe) && text1.includes(tribe))) {
      score += 0.3
      reasons.push(`${tribe} tribal`)
      type = 'tribal_synergy'
    }
  }
  
  // Analisi payoff patterns
  if (hasPattern(text1, COMBO_INDICATORS.payoffs) && hasPattern(text2, COMBO_INDICATORS.enablers)) {
    score += 0.25
    reasons.push('payoff-enabler pair')
    type = 'engine_combo'
  }
  
  // Analisi mana synergies
  if (hasPattern(text1, MANA_PATTERNS) || hasPattern(text2, MANA_PATTERNS)) {
    score += 0.2
    reasons.push('mana synergy')
    type = 'mana_combo'
  }
  
  // Analisi keyword interactions
  const keywordSynergies = [
    ['sacrifice', 'dies'],
    ['enters the battlefield', 'flicker'],
    ['untap', 'tap'],
    ['draw', 'discard'],
    ['damage', 'life'],
    ['counter', 'remove'],
    ['exile', 'return'],
    ['token', 'creature']
  ]
  
  for (const [key1, key2] of keywordSynergies) {
    if ((text1.includes(key1) && text2.includes(key2)) || 
        (text1.includes(key2) && text2.includes(key1))) {
      score += 0.15
      reasons.push(`${key1}-${key2} interaction`)
    }
  }
  
  // Bonus per carte dello stesso colore
  if (card1.color_identity && card2.color_identity) {
    const sharedColors = card1.color_identity.filter(c => card2.color_identity?.includes(c))
    if (sharedColors.length > 0) {
      score += 0.1
      reasons.push('color synergy')
    }
  }
  
  // Bonus per curve mana complementare
  const cmc1 = card1.cmc || 0
  const cmc2 = card2.cmc || 0
  if (Math.abs(cmc1 - cmc2) <= 2 && cmc1 + cmc2 <= 8) {
    score += 0.05
    reasons.push('good curve')
  }
  
  const description = `${getSafeName(card1)} + ${getSafeName(card2)}`
  const reasoning = reasons.length > 0 ? reasons.join(', ') : 'potential synergy'
  
  return { score, type, description, reasoning }
}

function hasPattern(text: string, patterns: string[]): boolean {
  return patterns.some(pattern => text.includes(pattern))
}

function findAdvancedTribalSynergies(cards: ScryFallCard[], log: string[]): ComboPattern[] {
  const patterns: ComboPattern[] = []
  
  for (const tribe of TRIBAL_TYPES) {
    const tribalCards = cards.filter(card => {
      const typeLine = getSafeTypeLine(card).toLowerCase()
      const oracleText = getSafeOracleText(card).toLowerCase()
      return typeLine.includes(tribe) || oracleText.includes(tribe)
    })
    
    if (tribalCards.length >= 2) {
      // Ogni combinazione di carte tribali
      for (let i = 0; i < tribalCards.length && i < 5; i++) {
        for (let j = i + 1; j < tribalCards.length && j < 5; j++) {
          patterns.push({
            cards: [tribalCards[i], tribalCards[j]],
            type: 'tribal_synergy',
            confidence: 0.6,
            description: `${tribe.charAt(0).toUpperCase() + tribe.slice(1)} tribal combo`,
            reasoning: `Both cards interact with ${tribe} creatures`
          })
        }
      }
    }
  }
  
  return patterns
}

function findEnginePayoffPairs(cards: ScryFallCard[], log: string[]): ComboPattern[] {
  const patterns: ComboPattern[] = []
  
  const engines = cards.filter(card => {
    const text = getSafeOracleText(card).toLowerCase()
    return hasPattern(text, COMBO_INDICATORS.enablers) || hasPattern(text, COMBO_INDICATORS.value)
  })
  
  const payoffs = cards.filter(card => {
    const text = getSafeOracleText(card).toLowerCase()
    return hasPattern(text, COMBO_INDICATORS.payoffs)
  })
  
  for (const engine of engines.slice(0, 10)) {
    for (const payoff of payoffs.slice(0, 10)) {
      if (engine.id !== payoff.id) {
        patterns.push({
          cards: [engine, payoff],
          type: 'engine_combo',
          confidence: 0.4,
          description: `${getSafeName(engine)} engine with ${getSafeName(payoff)} payoff`,
          reasoning: 'Engine enables payoff interaction'
        })
      }
    }
  }
  
  return patterns.slice(0, 20)
}

function findManaComboSynergies(cards: ScryFallCard[], log: string[]): ComboPattern[] {
  const patterns: ComboPattern[] = []
  
  const manaProducers = cards.filter(card => {
    const text = getSafeOracleText(card).toLowerCase()
    return hasPattern(text, MANA_PATTERNS)
  })
  
  const manaSpenders = cards.filter(card => {
    const text = getSafeOracleText(card).toLowerCase()
    return text.includes('x') || (card.cmc && card.cmc >= 5)
  })
  
  for (const producer of manaProducers.slice(0, 8)) {
    for (const spender of manaSpenders.slice(0, 8)) {
      if (producer.id !== spender.id) {
        patterns.push({
          cards: [producer, spender],
          type: 'mana_combo',
          confidence: 0.35,
          description: `${getSafeName(producer)} ramp for ${getSafeName(spender)}`,
          reasoning: 'Mana acceleration enables expensive spell'
        })
      }
    }
  }
  
  return patterns.slice(0, 15)
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
      // Soglia confidenza molto bassa - accetta quasi tutto
      if (pattern.confidence < 0.15) continue
      
      const cardNames = pattern.cards.map(c => getSafeName(c))
      
      if (cardNames.some(name => !name || name === 'Unknown Card')) {
        continue
      }
      
      // Check duplicati meno rigido
      const { data: existingCombo } = await supabase
        .from('combos')
        .select('id')
        .ilike('name', `%${cardNames[0]}%`)
        .limit(1)
      
      if (existingCombo && existingCombo.length > 0) {
        const { data: exactMatch } = await supabase
          .from('combos')
          .select('id')
          .ilike('name', `%${cardNames[1]}%`)
          .eq('id', existingCombo[0].id)
          
        if (exactMatch && exactMatch.length > 0) {
          continue // Skip only exact matches
        }
      }
      
      const comboId = generateUUID()
      const comboName = cardNames.join(' + ')
      
      const { error: comboError } = await supabase
        .from('combos')
        .insert({
          id: comboId,
          source: 'scryfall_aggressive',
          name: comboName,
          result_tag: pattern.description,
          color_identity: getComboColors(pattern.cards),
          links: [`https://scryfall.com/search?q=${encodeURIComponent(cardNames.join(' OR '))}`],
          steps: `${pattern.reasoning}. Confidence: ${Math.round(pattern.confidence * 100)}%`
        })
      
      if (comboError) {
        errors.push(`Error creating combo ${comboName}: ${comboError.message}`)
        continue
      }
      
      // Create card relationships
      const cardIds: string[] = []
      
      for (const card of pattern.cards) {
        const cardId = await findOrCreateCard(supabase, card, log, errors)
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
        log.push(`Created: ${comboName} (${Math.round(pattern.confidence * 100)}%)`)
      }
      
    } catch (error) {
      errors.push(`Error processing pattern: ${(error as Error).message}`)
    }
  }
  
  return combosCreated
}

async function findOrCreateCard(
  supabase: any,
  scryfallCard: ScryFallCard,
  log: string[],
  errors: string[]
): Promise<string | null> {
  try {
    if (!isValidCard(scryfallCard)) {
      return null
    }
    
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .ilike('name', getSafeName(scryfallCard))
      .limit(1)
    
    if (existingCards && existingCards.length > 0) {
      return existingCards[0].id
    }
    
    // Create new card
    const cardId = generateUUID()
    
    const { error: insertError } = await supabase
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
        tags: ['scryfall_aggressive', 'potential_combo']
      })
    
    if (insertError) {
      errors.push(`Error creating card ${getSafeName(scryfallCard)}: ${insertError.message}`)
      return null
    }
    
    return cardId
    
  } catch (error) {
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