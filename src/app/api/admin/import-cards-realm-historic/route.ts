// src/app/api/admin/import-cards-realm-historic/route.ts
// Importatore per MTG Cards Realm - Historic Brawl Combos

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY!

interface CardsRealmCombo {
  id: string
  name: string
  cards: Array<{ name: string; mana_cost?: string; type?: string }>
  colors: string[]
  format: string
  description: string
  steps: string[]
  result: string
  url: string
}

interface ImportResult {
  success: boolean
  message: string
  stats?: {
    total_fetched: number
    valid_combos: number
    imported: number
    skipped: number
    errors: number
  }
  log?: string[]
  errors?: string[]
}

// MTG Cards Realm API endpoints per Historic Brawl
const CARDS_REALM_BASE = 'https://mtg.cardsrealm.com'
const HISTORIC_BRAWL_FORMAT_ID = '35' // Historic Brawl format ID
const COLOR_COMBINATIONS = [
  { colors: 'W', name: 'Monowhite' },
  { colors: 'U', name: 'Monoblue' },
  { colors: 'B', name: 'Monoblack' },
  { colors: 'R', name: 'Monored' },
  { colors: 'G', name: 'Monogreen' },
  { colors: 'WU', name: 'Azorius' },
  { colors: 'WB', name: 'Orzhov' },
  { colors: 'WR', name: 'Boros' },
  { colors: 'WG', name: 'Selesnya' },
  { colors: 'UB', name: 'Dimir' },
  { colors: 'UR', name: 'Izzet' },
  { colors: 'UG', name: 'Simic' },
  { colors: 'BR', name: 'Rakdos' },
  { colors: 'BG', name: 'Golgari' },
  { colors: 'RG', name: 'Gruul' },
  { colors: 'WUB', name: 'Esper' },
  { colors: 'WUR', name: 'Jeskai' },
  { colors: 'WUG', name: 'Bant' },
  { colors: 'WBR', name: 'Mardu' },
  { colors: 'WBG', name: 'Abzan' },
  { colors: 'WRG', name: 'Naya' },
  { colors: 'UBR', name: 'Grixis' },
  { colors: 'UBG', name: 'Sultai' },
  { colors: 'URG', name: 'Temur' },
  { colors: 'BRG', name: 'Jund' },
  { colors: 'WUBR', name: 'Four-Color' },
  { colors: 'WUBG', name: 'Four-Color' },
  { colors: 'WURG', name: 'Four-Color' },
  { colors: 'WBRG', name: 'Four-Color' },
  { colors: 'UBRG', name: 'Four-Color' },
  { colors: 'WUBRG', name: 'Five-Color' }
]

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    const body = await request.json()
    const { 
      adminKey, 
      maxCombos = 200, 
      colorFilter = null,
      skipExisting = true 
    } = body
    
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }
    
    log.push('Starting MTG Cards Realm Historic Brawl import...')
    log.push(`Target: ${maxCombos} combos for Historic Brawl format`)
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Step 1: Fetch combo data from Cards Realm
    log.push('Fetching combo data from MTG Cards Realm...')
    const combosData = await fetchCardsRealmHistoricCombos(colorFilter, maxCombos, log, errors)
    
    if (!combosData || combosData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch data from MTG Cards Realm',
        errors,
        log
      }, { status: 500 })
    }
    
    log.push(`Fetched ${combosData.length} Historic Brawl combos from Cards Realm`)
    
    // Step 2: Parse and validate combos
    log.push('Parsing and validating combo data...')
    const parsedCombos = parseCardsRealmData(combosData, log, errors)
    
    // Step 3: Import to database
    log.push('Importing combos to database...')
    const importStats = await importCombosToDatabase(supabase, parsedCombos, skipExisting, log, errors)
    
    const finalStats = {
      total_fetched: combosData.length,
      valid_combos: parsedCombos.length,
      imported: importStats.imported,
      skipped: importStats.skipped,
      errors: errors.length
    }
    
    log.push('MTG Cards Realm import completed!')
    log.push(`Imported: ${importStats.imported} Historic Brawl combos`)
    log.push(`Skipped: ${importStats.skipped} combos`)
    log.push(`Errors: ${errors.length}`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importStats.imported} Historic Brawl combos from MTG Cards Realm`,
      stats: finalStats,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      log
    })
    
  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`MTG Cards Realm import failed: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      message: 'MTG Cards Realm import failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function fetchCardsRealmHistoricCombos(
  colorFilter: string[] | null, 
  maxCombos: number,
  log: string[], 
  errors: string[]
): Promise<any[] | null> {
  const allCombos: any[] = []
  
  try {
    // Determina quali combinazioni di colori cercare
    const targetColors = colorFilter || COLOR_COMBINATIONS.map(c => c.colors)
    
    for (const colorCombo of targetColors) {
      if (allCombos.length >= maxCombos) break
      
      const colors = typeof colorCombo === 'string' ? colorCombo : String(colorCombo)
      
      log.push(`Fetching ${colors} combos for Historic Brawl...`)
      
      // Costruisci URL per MTG Cards Realm API
      const url = buildCardsRealmUrl(colors)
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
            'Accept': 'application/json, text/html',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        })
        
        if (!response.ok) {
          errors.push(`Failed to fetch ${colors} combos: ${response.status}`)
          continue
        }
        
        const data = await parseCardsRealmResponse(response, colors, log, errors)
        
        if (data && data.length > 0) {
          allCombos.push(...data)
          log.push(`Found ${data.length} combos for ${colors}`)
        }
        
        // Rate limiting - aspetta tra le richieste
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (fetchError) {
        errors.push(`Error fetching ${colors}: ${(fetchError as Error).message}`)
      }
    }
    
    return allCombos.slice(0, maxCombos)
    
  } catch (error) {
    errors.push(`Error in fetchCardsRealmHistoricCombos: ${(error as Error).message}`)
    
    // Fallback: mock data per Historic Brawl
    log.push('Using Historic Brawl mock data...')
    return getHistoricBrawlMockData()
  }
}

function buildCardsRealmUrl(colors: string): string {
  // Converte colori in formato Cards Realm
  const colorParam = colors.split('').join('')
  
  return `${CARDS_REALM_BASE}/it-it/combo-infinite/?` +
    `&types=` +
    `&order=combo_datetime%20DESC` +
    `&colors=${colorParam}` +
    `&card_path=` +
    `&color_operator=or` +
    `&card_format=${HISTORIC_BRAWL_FORMAT_ID}`
}

async function parseCardsRealmResponse(
  response: Response, 
  colors: string,
  log: string[], 
  errors: string[]
): Promise<any[] | null> {
  try {
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      // Se risponde JSON direttamente
      return await response.json()
    } else {
      // Se risponde HTML, parsing della pagina
      const html = await response.text()
      return parseCardsRealmHtml(html, colors, log, errors)
    }
    
  } catch (error) {
    errors.push(`Error parsing Cards Realm response for ${colors}: ${(error as Error).message}`)
    return null
  }
}

function parseCardsRealmHtml(html: string, colors: string, log: string[], errors: string[]): any[] {
  const combos: any[] = []
  
  try {
    // Regex per estrarre informazioni combo dalla pagina HTML
    const comboRegex = /<div[^>]*class="combo[^"]*"[^>]*>(.*?)<\/div>/gs
    const titleRegex = /<h[^>]*>(.*?)<\/h[^>]*>/
    const cardRegex = /<span[^>]*class="card[^"]*"[^>]*>(.*?)<\/span>/g
    const descriptionRegex = /<p[^>]*class="description[^"]*"[^>]*>(.*?)<\/p>/s
    
    const comboMatches = html.match(comboRegex) || []
    
    comboMatches.forEach((comboHtml, index) => {
      try {
        const titleMatch = comboHtml.match(titleRegex)
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : `${colors} Combo ${index + 1}`
        
        const cardMatches = [...comboHtml.matchAll(cardRegex)]
        const cards = cardMatches.map(match => ({
          name: match[1].replace(/<[^>]*>/g, '').trim()
        })).filter(card => card.name.length > 0)
        
        const descMatch = comboHtml.match(descriptionRegex)
        const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : 'Historic Brawl combo'
        
        if (cards.length >= 2) {
          combos.push({
            id: `cards_realm_${colors}_${index}`,
            name: title,
            cards: cards,
            colors: colors.split(''),
            format: 'Historic Brawl',
            description: description,
            steps: [description],
            result: 'Combo synergy',
            url: `${CARDS_REALM_BASE}/combo/${index}`
          })
        }
        
      } catch (parseError) {
        errors.push(`Error parsing individual combo: ${(parseError as Error).message}`)
      }
    })
    
    log.push(`Parsed ${combos.length} combos from HTML for ${colors}`)
    
  } catch (error) {
    errors.push(`Error parsing HTML for ${colors}: ${(error as Error).message}`)
  }
  
  return combos
}

function parseCardsRealmData(rawData: any[], log: string[], errors: string[]): any[] {
  const validCombos: any[] = []
  
  for (const item of rawData) {
    try {
      if (!item.id || !item.cards || !Array.isArray(item.cards)) {
        continue
      }
      
      if (item.cards.length < 2) {
        continue // Skip combos with less than 2 cards
      }
      
      // Extract card names
      const cardNames = item.cards
        .map((card: any) => card.name || card)
        .filter((name: string) => name && typeof name === 'string' && name.length > 0)
      
      if (cardNames.length === 0) continue
      
      // Parse color identity
      const colorIdentity = item.colors || []
      
      // Create description
      const description = item.description || item.steps?.join('. ') || 'Historic Brawl combo synergy'
      
      // Determine result tag
      const resultTag = determineResultTag(description, item.result || '')
      
      const parsedCombo = {
        external_id: item.id?.toString() || `cr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: item.name || generateComboName(cardNames, resultTag),
        result_tag: resultTag,
        steps: description,
        color_identity: colorIdentity,
        source: 'cards_realm_historic',
        format: 'Historic Brawl',
        cards: cardNames,
        permalink: item.url || `${CARDS_REALM_BASE}/combo/${item.id}`
      }
      
      validCombos.push(parsedCombo)
      
    } catch (error) {
      errors.push(`Error parsing combo ${item.id}: ${(error as Error).message}`)
    }
  }
  
  log.push(`Parsed ${validCombos.length} valid Historic Brawl combos`)
  
  return validCombos
}

function determineResultTag(description: string, result: string): string {
  const allText = (description + ' ' + result).toLowerCase()
  
  if (allText.includes('infinite')) {
    if (allText.includes('damage')) return 'Infinite Damage'
    if (allText.includes('mana')) return 'Infinite Mana'
    if (allText.includes('token') || allText.includes('creature')) return 'Infinite Tokens'
    if (allText.includes('mill')) return 'Infinite Mill'
    if (allText.includes('life')) return 'Infinite Life'
    if (allText.includes('draw')) return 'Infinite Draw'
    return 'Infinite Combo'
  }
  
  if (allText.includes('win') || allText.includes('victory')) return 'Win Condition'
  if (allText.includes('damage')) return 'Direct Damage'
  if (allText.includes('mill')) return 'Mill Strategy'
  if (allText.includes('token')) return 'Token Generation'
  if (allText.includes('draw') || allText.includes('card')) return 'Card Advantage'
  if (allText.includes('counter')) return 'Counter Strategy'
  if (allText.includes('life')) return 'Life Gain'
  
  return 'Historic Brawl Synergy'
}

function generateComboName(cardNames: string[], resultTag: string): string {
  if (cardNames.length === 0) return resultTag
  if (cardNames.length === 1) return `${cardNames[0]} Historic Combo`
  if (cardNames.length === 2) return `${cardNames[0]} + ${cardNames[1]}`
  if (cardNames.length === 3) return `${cardNames[0]} + ${cardNames[1]} + ${cardNames[2]}`
  
  return `${cardNames[0]} + ${cardNames[1]} + ${cardNames.length - 2} others`
}

async function importCombosToDatabase(
  supabase: any,
  combos: any[],
  skipExisting: boolean,
  log: string[],
  errors: string[]
): Promise<{ imported: number, skipped: number }> {
  let imported = 0
  let skipped = 0
  
  for (const combo of combos) {
    try {
      if (skipExisting) {
        // Check if combo already exists
        const { data: existing } = await supabase
          .from('combos')
          .select('id')
          .eq('source', 'cards_realm_historic')
          .eq('name', combo.name)
          .single()
        
        if (existing) {
          skipped++
          continue
        }
      }
      
      // Insert new combo
      const { error: insertError } = await supabase
        .from('combos')
        .insert({
          name: combo.name,
          result_tag: combo.result_tag,
          steps: combo.steps,
          color_identity: combo.color_identity,
          source: combo.source,
          format: combo.format,
          links: combo.permalink ? [combo.permalink] : []
        })
      
      if (insertError) {
        errors.push(`Failed to insert combo "${combo.name}": ${insertError.message}`)
        continue
      }
      
      imported++
      
      // Log progress every 25 combos
      if (imported % 25 === 0) {
        log.push(`Imported ${imported} Historic Brawl combos...`)
      }
      
    } catch (error) {
      errors.push(`Error importing combo "${combo.name}": ${(error as Error).message}`)
    }
  }
  
  return { imported, skipped }
}

// Mock data specifici per Historic Brawl
function getHistoricBrawlMockData(): any[] {
  return [
    {
      id: 'hb_mock_1',
      name: 'Jeskai Ascendancy Infinite',
      cards: [
        { name: 'Jeskai Ascendancy' },
        { name: 'Springleaf Drum' },
        { name: 'Retraction Helix' }
      ],
      colors: ['W', 'U', 'R'],
      format: 'Historic Brawl',
      description: 'Cast Retraction Helix on a creature, tap for mana with Springleaf Drum, return and replay cheap artifacts for infinite storm.',
      steps: ['Play Jeskai Ascendancy and Springleaf Drum', 'Cast Retraction Helix on a creature', 'Tap creature for mana, return and replay artifacts'],
      result: 'Infinite storm count and mana',
      url: 'https://mtg.cardsrealm.com/combo/jeskai-ascendancy'
    },
    {
      id: 'hb_mock_2',
      name: 'Thassa\'s Oracle Win',
      cards: [
        { name: 'Thassa\'s Oracle' },
        { name: 'Tainted Pact' }
      ],
      colors: ['U', 'B'],
      format: 'Historic Brawl',
      description: 'Use Tainted Pact to exile your library, then play Thassa\'s Oracle to win immediately.',
      steps: ['Cast Tainted Pact naming a card not in deck', 'Cast Thassa\'s Oracle with empty library'],
      result: 'Win the game',
      url: 'https://mtg.cardsrealm.com/combo/thassas-oracle'
    },
    {
      id: 'hb_mock_3',
      name: 'Heliod Sun-Crowned Infinite',
      cards: [
        { name: 'Heliod, Sun-Crowned' },
        { name: 'Walking Ballista' }
      ],
      colors: ['W'],
      format: 'Historic Brawl',
      description: 'Heliod gives Walking Ballista lifelink. Gain life, put +1/+1 counters, remove to deal damage, repeat.',
      steps: ['Have Heliod and Walking Ballista with 2+ counters', 'Remove counter to deal 1 damage', 'Gain 1 life from lifelink', 'Heliod puts +1/+1 counter back'],
      result: 'Infinite damage',
      url: 'https://mtg.cardsrealm.com/combo/heliod-ballista'
    }
  ]
}

// GET endpoint per status
export async function GET() {
  return NextResponse.json({
    status: 'MTG Cards Realm Historic Brawl Importer',
    format: 'Historic Brawl (MTG Arena)',
    endpoints: {
      'POST /import': 'Import Historic Brawl combos from MTG Cards Realm',
      'Parameters': {
        'adminKey': 'Required admin key',
        'maxCombos': 'Max combos to import (default: 200)',
        'colorFilter': 'Optional array of colors to filter by',
        'skipExisting': 'Skip already imported combos (default: true)'
      }
    },
    supported_colors: COLOR_COMBINATIONS.map(c => ({ colors: c.colors, name: c.name })),
    environment_variables_required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NEXT_PUBLIC_ADMIN_KEY'
    ]
  })
}