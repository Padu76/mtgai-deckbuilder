// src/app/api/admin/analyze-new-sets/route.ts
// Analyzer per combo delle ultime espansioni - nuove carte vs database esistente

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

function getSafeName(card: any): string {
  if (!card || typeof card.name !== 'string') return 'Unknown Card'
  return card.name
}

// Pattern per identificare combo innovative
const INNOVATION_PATTERNS = {
  new_mechanics: ['energy', 'foretell', 'mutate', 'escape', 'adapt', 'explore', 'amass', 'surveil'],
  combo_enablers: ['flash', 'enters tapped', 'untap', 'sacrifice', 'return', 'flicker'],
  meta_shifts: ['protection from', 'can\'t be countered', 'hexproof', 'ward', 'indestructible'],
  value_engines: ['whenever', 'draw', 'create', 'search', 'tutor', 'look at'],
  win_conditions: ['damage', 'life', 'mill', 'poison', 'alternative win']
}

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
  set: string
  set_name?: string
  released_at?: string
  rarity?: string
  image_uris?: {
    normal?: string
  }
  games?: string[]
}

interface ExistingCard {
  id: string
  name: string
  oracle_text: string
  types: string[]
  colors: string[]
  mana_value: number
}

interface NewSetCombo {
  cards: ScryFallCard[]
  existing_cards?: ExistingCard[]
  type: string
  confidence: number
  description: string
  innovation_score: number
  meta_impact: string
  reasoning: string
}

interface AnalysisResult {
  success: boolean
  message: string
  stats?: {
    new_cards_analyzed: number
    existing_cards_matched: number
    internal_combos: number
    cross_combos: number
    total_combos_created: number
  }
  sets_analyzed?: string[]
  errors?: string[]
  log?: string[]
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    log.push('Starting new expansion combo analysis...')
    
    const body = await request.json()
    const adminKey = body.adminKey || request.headers.get('x-admin-key')
    const expansionsCount = body.expansionsCount || 3
    
    if (adminKey !== config.admin.key) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }

    const supabase = createClient(config.supabase.url, config.supabase.serviceKey)
    log.push('Supabase client initialized')

    // Step 1: Fetch recent expansion sets
    log.push(`Fetching last ${expansionsCount} expansion sets...`)
    const recentSets = await getRecentExpansionSets(log)
    const targetSets = recentSets.slice(0, expansionsCount)
    log.push(`Target sets: ${targetSets.join(', ')}`)

    // Step 2: Fetch new cards from target sets
    log.push('Fetching new cards from recent sets...')
    const newCards = await fetchNewSetCards(targetSets, log)
    log.push(`Found ${newCards.length} new Arena cards`)

    // Step 3: Load existing combo cards from database
    log.push('Loading existing combo cards from database...')
    const existingCards = await loadExistingComboCards(supabase, log)
    log.push(`Loaded ${existingCards.length} existing combo cards`)

    // Step 4: Analyze internal combos (new card + new card)
    log.push('Analyzing internal combos (new + new)...')
    const internalCombos = analyzeInternalCombos(newCards, log)
    log.push(`Found ${internalCombos.length} internal combo patterns`)

    // Step 5: Analyze cross combos (new card + existing card)
    log.push('Analyzing cross combos (new + existing)...')
    const crossCombos = analyzeCrossCombos(newCards, existingCards, log)
    log.push(`Found ${crossCombos.length} cross combo patterns`)

    // Step 6: Create combos in database
    const allCombos = [...internalCombos, ...crossCombos]
    log.push(`Creating ${allCombos.length} total combos in database...`)
    const combosCreated = await createNewSetCombos(supabase, allCombos, log, errors)

    const stats = {
      new_cards_analyzed: newCards.length,
      existing_cards_matched: existingCards.length,
      internal_combos: internalCombos.length,
      cross_combos: crossCombos.length,
      total_combos_created: combosCreated
    }

    log.push('New expansion analysis completed!')
    log.push(`Created ${combosCreated} innovative combos from recent sets`)

    return NextResponse.json({
      success: true,
      message: `Analyzed ${newCards.length} new cards, created ${combosCreated} meta-relevant combos`,
      stats,
      sets_analyzed: targetSets,
      errors: errors.length > 0 ? errors : undefined,
      log
    })

  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`New set analysis failed: ${errorMessage}`)

    return NextResponse.json({
      success: false,
      message: 'New expansion combo analysis failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function getRecentExpansionSets(log: string[]): Promise<string[]> {
  try {
    // Fetch recent sets from Scryfall
    const response = await fetch('https://api.scryfall.com/sets', {
      headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
    })
    
    if (!response.ok) {
      throw new Error(`Scryfall sets API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Filter per expansion sets, ordina per data release
    const expansionSets = data.data
      .filter((set: any) => 
        set.set_type === 'expansion' && 
        new Date(set.released_at) > new Date('2023-01-01') // Solo set recenti
      )
      .sort((a: any, b: any) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime())
      .map((set: any) => set.code)
    
    log.push(`Found recent expansion sets: ${expansionSets.slice(0, 5).join(', ')}`)
    return expansionSets
    
  } catch (error) {
    log.push(`Error fetching sets: ${(error as Error).message}`)
    // Fallback con set noti recenti
    return ['ltr', 'mom', 'one', 'bro', 'dmu']
  }
}

async function fetchNewSetCards(targetSets: string[], log: string[]): Promise<ScryFallCard[]> {
  const allNewCards: ScryFallCard[] = []
  
  for (const setCode of targetSets) {
    try {
      log.push(`Fetching cards from set: ${setCode}`)
      
      const query = `game:arena set:${setCode} (oracle:"enters" OR oracle:"dies" OR oracle:"when" OR oracle:"whenever" OR oracle:"sacrifice" OR oracle:"return" OR oracle:"create" OR oracle:"draw" OR oracle:"damage")`
      
      const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          log.push(`No relevant cards found in set ${setCode}`)
          continue
        }
        throw new Error(`API error for set ${setCode}: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        const validCards = data.data.filter((card: any) => {
          return isValidCard(card) && 
                 card.games && 
                 card.games.includes('arena') &&
                 (card.legalities.historic === 'legal' || card.legalities.standard === 'legal')
        })
        
        allNewCards.push(...validCards)
        log.push(`Added ${validCards.length} cards from ${setCode}`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      log.push(`Error fetching set ${setCode}: ${(error as Error).message}`)
    }
  }
  
  // Remove duplicates
  const uniqueCards = allNewCards.filter((card, index, self) => 
    self.findIndex(c => c.id === card.id) === index
  )
  
  return uniqueCards
}

async function loadExistingComboCards(supabase: any, log: string[]): Promise<ExistingCard[]> {
  try {
    // Carica carte che sono già parte di combo nel database
    const { data: comboCardIds } = await supabase
      .from('combo_cards')
      .select('card_id')
    
    if (!comboCardIds || comboCardIds.length === 0) {
      log.push('No existing combo cards found in database')
      return []
    }
    
    const cardIds = comboCardIds.map((row: any) => row.card_id)
    
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id, name, oracle_text, types, colors, mana_value')
      .in('id', cardIds.slice(0, 200)) // Limit per performance
    
    return existingCards || []
    
  } catch (error) {
    log.push(`Error loading existing cards: ${(error as Error).message}`)
    return []
  }
}

function analyzeInternalCombos(newCards: ScryFallCard[], log: string[]): NewSetCombo[] {
  const combos: NewSetCombo[] = []
  
  log.push(`Analyzing internal combos among ${newCards.length} new cards...`)
  
  // Analizza ogni coppia di carte nuove
  for (let i = 0; i < newCards.length && i < 30; i++) {
    for (let j = i + 1; j < newCards.length && j < 30; j++) {
      const card1 = newCards[i]
      const card2 = newCards[j]
      
      const synergy = analyzeNewCardSynergy(card1, card2, true)
      
      if (synergy.confidence > 0.3) { // Soglia per combo interni
        combos.push({
          cards: [card1, card2],
          type: 'internal_combo',
          confidence: synergy.confidence,
          description: `${getSafeName(card1)} + ${getSafeName(card2)} (${card1.set}+${card2.set})`,
          innovation_score: synergy.innovation_score,
          meta_impact: synergy.meta_impact,
          reasoning: synergy.reasoning
        })
      }
    }
  }
  
  log.push(`Generated ${combos.length} internal combo candidates`)
  
  return combos.sort((a, b) => b.confidence - a.confidence).slice(0, 25)
}

function analyzeCrossCombos(newCards: ScryFallCard[], existingCards: ExistingCard[], log: string[]): NewSetCombo[] {
  const combos: NewSetCombo[] = []
  
  log.push(`Analyzing cross combos: ${newCards.length} new vs ${existingCards.length} existing...`)
  
  for (const newCard of newCards.slice(0, 20)) {
    for (const existingCard of existingCards.slice(0, 50)) {
      try {
        const synergy = analyzeNewVsExistingSynergy(newCard, existingCard)
        
        if (synergy.confidence > 0.25) { // Soglia più bassa per combo cross
          combos.push({
            cards: [newCard],
            existing_cards: [existingCard],
            type: 'cross_combo',
            confidence: synergy.confidence,
            description: `${getSafeName(newCard)} (${newCard.set}) + ${existingCard.name} (existing)`,
            innovation_score: synergy.innovation_score,
            meta_impact: synergy.meta_impact,
            reasoning: synergy.reasoning
          })
        }
      } catch (error) {
        // Skip problematic combinations
      }
    }
  }
  
  log.push(`Generated ${combos.length} cross combo candidates`)
  
  return combos.sort((a, b) => b.innovation_score - a.innovation_score).slice(0, 35)
}

function analyzeNewCardSynergy(card1: ScryFallCard, card2: ScryFallCard, isInternal: boolean) {
  let confidence = 0
  let innovation_score = 0
  const reasons: string[] = []
  let meta_impact = 'low'
  
  const text1 = getSafeOracleText(card1).toLowerCase()
  const text2 = getSafeOracleText(card2).toLowerCase()
  
  // Bonus per carte dello stesso set (meta synergy)
  if (isInternal && card1.set === card2.set) {
    confidence += 0.2
    innovation_score += 0.3
    reasons.push('same set synergy')
    meta_impact = 'medium'
  }
  
  // Analisi nuove meccaniche
  for (const mechanic of INNOVATION_PATTERNS.new_mechanics) {
    if (text1.includes(mechanic) && text2.includes(mechanic)) {
      confidence += 0.3
      innovation_score += 0.4
      reasons.push(`${mechanic} interaction`)
      meta_impact = 'high'
    }
  }
  
  // Pattern trigger-enabler
  const triggers = ['when', 'whenever', 'enters', 'dies', 'attacks']
  const enablers = ['sacrifice', 'return', 'flicker', 'untap', 'bounce']
  
  const hasTrigger1 = triggers.some(t => text1.includes(t))
  const hasEnabler2 = enablers.some(e => text2.includes(e))
  const hasTrigger2 = triggers.some(t => text2.includes(t))
  const hasEnabler1 = enablers.some(e => text1.includes(e))
  
  if ((hasTrigger1 && hasEnabler2) || (hasTrigger2 && hasEnabler1)) {
    confidence += 0.25
    innovation_score += 0.2
    reasons.push('trigger-enabler pattern')
  }
  
  // Value engine detection
  if ((text1.includes('draw') || text1.includes('create')) && 
      (text2.includes('whenever') || text2.includes('when'))) {
    confidence += 0.2
    innovation_score += 0.25
    reasons.push('value engine potential')
    meta_impact = meta_impact === 'low' ? 'medium' : meta_impact
  }
  
  // Win condition synergy
  const winCons = ['damage', 'life', 'mill', 'poison']
  if (winCons.some(w => text1.includes(w) && text2.includes(w))) {
    confidence += 0.15
    innovation_score += 0.2
    reasons.push('win condition synergy')
  }
  
  // Mana curve synergy
  const cmc1 = card1.cmc || 0
  const cmc2 = card2.cmc || 0
  if (cmc1 <= 3 && cmc2 <= 3 && Math.abs(cmc1 - cmc2) <= 1) {
    confidence += 0.1
    reasons.push('good curve')
  }
  
  return {
    confidence,
    innovation_score,
    reasoning: reasons.join(', ') || 'potential synergy',
    meta_impact
  }
}

function analyzeNewVsExistingSynergy(newCard: ScryFallCard, existingCard: ExistingCard) {
  let confidence = 0
  let innovation_score = 0
  const reasons: string[] = []
  let meta_impact = 'medium' // Cross combo sempre medium+
  
  const newText = getSafeOracleText(newCard).toLowerCase()
  const existingText = (existingCard.oracle_text || '').toLowerCase()
  
  // Bonus per introdurre nuova meccanica a combo esistente
  for (const mechanic of INNOVATION_PATTERNS.new_mechanics) {
    if (newText.includes(mechanic) && !existingText.includes(mechanic)) {
      confidence += 0.35
      innovation_score += 0.5
      reasons.push(`new ${mechanic} mechanic`)
      meta_impact = 'high'
    }
  }
  
  // Pattern recognition base
  const interactions = [
    ['enters the battlefield', 'flicker'],
    ['dies', 'sacrifice'],
    ['create', 'whenever'],
    ['damage', 'life'],
    ['draw', 'discard'],
    ['untap', 'tap']
  ]
  
  for (const [pattern1, pattern2] of interactions) {
    if ((newText.includes(pattern1) && existingText.includes(pattern2)) ||
        (newText.includes(pattern2) && existingText.includes(pattern1))) {
      confidence += 0.2
      innovation_score += 0.15
      reasons.push(`${pattern1}-${pattern2} interaction`)
    }
  }
  
  // Tribal synergy con carte esistenti
  const tribes = ['goblin', 'elf', 'vampire', 'zombie', 'human']
  for (const tribe of tribes) {
    if (newText.includes(tribe) && existingText.includes(tribe)) {
      confidence += 0.25
      innovation_score += 0.2
      reasons.push(`${tribe} tribal synergy`)
    }
  }
  
  // Mana fixing/acceleration
  if ((newText.includes('mana') || newText.includes('add')) && 
      existingCard.mana_value >= 5) {
    confidence += 0.15
    innovation_score += 0.1
    reasons.push('mana acceleration combo')
  }
  
  return {
    confidence,
    innovation_score,
    reasoning: reasons.join(', ') || 'cross-set synergy',
    meta_impact
  }
}

async function createNewSetCombos(
  supabase: any,
  combos: NewSetCombo[],
  log: string[],
  errors: string[]
): Promise<number> {
  let combosCreated = 0
  
  for (const combo of combos) {
    try {
      // Skip combo con confidenza troppo bassa
      if (combo.confidence < 0.2) continue
      
      const comboId = generateUUID()
      let comboName = ''
      
      if (combo.existing_cards) {
        // Cross combo: new card + existing card
        comboName = `${getSafeName(combo.cards[0])} + ${combo.existing_cards[0].name}`
      } else {
        // Internal combo: new card + new card
        comboName = combo.cards.map(c => getSafeName(c)).join(' + ')
      }
      
      // Check duplicati
      const { data: existingCombo } = await supabase
        .from('combos')
        .select('id')
        .ilike('name', `%${getSafeName(combo.cards[0])}%`)
        .limit(1)
      
      if (existingCombo && existingCombo.length > 0) continue
      
      const { error: comboError } = await supabase
        .from('combos')
        .insert({
          id: comboId,
          source: 'new_set_analysis',
          name: comboName,
          result_tag: combo.description,
          color_identity: getComboColors(combo.cards),
          links: [`https://scryfall.com/search?q=${encodeURIComponent(comboName)}`],
          steps: `${combo.reasoning}. Innovation: ${Math.round(combo.innovation_score * 100)}%, Meta Impact: ${combo.meta_impact}`
        })
      
      if (comboError) {
        errors.push(`Error creating combo ${comboName}: ${comboError.message}`)
        continue
      }
      
      // Create card relationships
      const cardIds: string[] = []
      
      // Add new cards
      for (const card of combo.cards) {
        const cardId = await findOrCreateCard(supabase, card, log, errors)
        if (cardId) cardIds.push(cardId)
      }
      
      // Add existing cards
      if (combo.existing_cards) {
        for (const existingCard of combo.existing_cards) {
          cardIds.push(existingCard.id)
        }
      }
      
      if (cardIds.length > 0) {
        const comboCardRows = cardIds.map(cardId => ({
          combo_id: comboId,
          card_id: cardId
        }))
        
        await supabase.from('combo_cards').insert(comboCardRows)
        combosCreated++
        
        const impactLabel = combo.meta_impact === 'high' ? ' 🔥' : combo.meta_impact === 'medium' ? ' ⚡' : ''
        log.push(`Created: ${comboName}${impactLabel} (${Math.round(combo.confidence * 100)}%)`)
      }
      
    } catch (error) {
      errors.push(`Error processing combo: ${(error as Error).message}`)
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
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .ilike('name', getSafeName(scryfallCard))
      .limit(1)
    
    if (existingCards && existingCards.length > 0) {
      return existingCards[0].id
    }
    
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
        types: scryfallCard.type_line.split(' — ').filter(t => t.trim()),
        oracle_text: getSafeOracleText(scryfallCard),
        legal_standard: scryfallCard.legalities?.standard === 'legal',
        legal_historic: scryfallCard.legalities?.historic === 'legal',
        legal_brawl: scryfallCard.legalities?.brawl === 'legal',
        in_arena: true,
        image_url: scryfallCard.image_uris?.normal || '',
        tags: ['new_set_import', 'meta_relevant', scryfallCard.set]
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
    const colors = card.color_identity || []
    for (const color of colors) {
      if (typeof color === 'string') {
        allColors.add(color)
      }
    }
  }
  
  return Array.from(allColors)
}