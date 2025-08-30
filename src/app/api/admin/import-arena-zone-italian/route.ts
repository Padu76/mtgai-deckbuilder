// src/app/api/admin/import-arena-zone-italian/route.ts
// Importatore MTG Arena Zone per nomi italiani specifici Arena

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY!

interface ArenaZoneCard {
  id: string
  name: string
  name_it?: string
  set_code: string
  collector_number: string
  rarity: string
  mana_cost?: string
  type_line?: string
  oracle_text?: string
  flavor_text?: string
  image_url?: string
  arena_id?: number
}

interface ImportResult {
  success: boolean
  message: string
  stats?: {
    cards_processed: number
    cards_with_existing_italian: number
    new_italian_translations: number
    arena_zone_queries: number
    errors: number
    coverage_improvement: string
    sets_processed: string[]
  }
  log?: string[]
  errors?: string[]
}

// MTG Arena Zone endpoints
const ARENA_ZONE_BASE = 'https://mtgazone.com'
const ARENA_ZONE_API = 'https://mtgazone.com/api'
const RATE_LIMIT_DELAY = 200 // Conservative rate limiting

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Set codes prioritari per Arena (più recenti e rilevanti)
const PRIORITY_SETS = [
  'BRO', 'DMU', 'SNC', 'NEO', 'VOW', 'MID', 'AFR', 'STX', 
  'KHM', 'ZNR', 'M21', 'IKO', 'THB', 'ELD', 'M20', 'WAR',
  'RNA', 'GRN', 'M19', 'DOM', 'RIX', 'XLN'
]

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    const body = await request.json()
    const { 
      adminKey, 
      maxCards = 300,
      skipExisting = true,
      prioritySets = true,
      specificSets = null
    } = body
    
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }
    
    log.push('Starting MTG Arena Zone Italian import...')
    log.push(`Target: ${maxCards} cards, priority sets: ${prioritySets}`)
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Step 1: Get cards without Italian names
    log.push('Loading Arena cards without Italian translations...')
    const cardsToProcess = await getArenaCardsWithoutItalian(
      supabase, 
      maxCards, 
      prioritySets ? PRIORITY_SETS : null,
      specificSets,
      log
    )
    
    if (cardsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Arena cards need Italian translation from Arena Zone',
        stats: {
          cards_processed: 0,
          cards_with_existing_italian: 0,
          new_italian_translations: 0,
          arena_zone_queries: 0,
          errors: 0,
          coverage_improvement: '0%',
          sets_processed: []
        },
        log
      })
    }
    
    log.push(`Found ${cardsToProcess.length} Arena cards without Italian names`)
    
    // Step 2: Search Italian translations from Arena Zone
    log.push('Searching Italian translations from MTG Arena Zone...')
    const translationResults = await searchArenaZoneTranslations(cardsToProcess, log, errors)
    
    // Step 3: Update database
    log.push('Updating database with Arena Zone translations...')
    const updateStats = await updateDatabaseWithArenaZoneTranslations(supabase, translationResults, log, errors)
    
    const coverageImprovement = cardsToProcess.length > 0 
      ? ((updateStats.translations_found / cardsToProcess.length) * 100).toFixed(1) + '%'
      : '0%'
    
    const setsProcessed = [...new Set(cardsToProcess.map(c => c.set_code))]
    
    const finalStats = {
      cards_processed: cardsToProcess.length,
      cards_with_existing_italian: 0, // Already filtered out
      new_italian_translations: updateStats.translations_found,
      arena_zone_queries: updateStats.queries_made,
      errors: errors.length,
      coverage_improvement: coverageImprovement,
      sets_processed: setsProcessed
    }
    
    log.push('MTG Arena Zone import completed!')
    log.push(`Processed ${cardsToProcess.length} cards from ${setsProcessed.length} sets`)
    log.push(`Found ${updateStats.translations_found} Italian translations from Arena Zone`)
    log.push(`Coverage improvement: ${coverageImprovement}`)
    
    return NextResponse.json({
      success: true,
      message: `Found ${updateStats.translations_found} Italian translations from MTG Arena Zone`,
      stats: finalStats,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      log
    })
    
  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`Arena Zone import failed: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      message: 'MTG Arena Zone import failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function getArenaCardsWithoutItalian(
  supabase: any, 
  maxCards: number,
  prioritySets: string[] | null,
  specificSets: string[] | null,
  log: string[]
): Promise<Array<{id: string, name: string, set_code: string, collector_number?: string}>> {
  let query = supabase
    .from('cards')
    .select('id, name, set_code, collector_number')
    .eq('in_arena', true) // Solo carte Arena
    .or('name_it.is.null,name_it.eq.')
    .not('name', 'is', null)
    .limit(maxCards)
  
  // Filtro per set specifici
  if (specificSets && specificSets.length > 0) {
    query = query.in('set_code', specificSets)
    log.push(`Filtering to specific sets: ${specificSets.join(', ')}`)
  } else if (prioritySets && prioritySets.length > 0) {
    query = query.in('set_code', prioritySets)
    log.push(`Using priority Arena sets: ${prioritySets.slice(0, 5).join(', ')}...`)
  }
  
  // Ordina per set più recente per prioritizzare carte attuali
  query = query.order('set_code', { ascending: false }).order('name')
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Failed to load Arena cards: ${error.message}`)
  }
  
  return data || []
}

async function searchArenaZoneTranslations(
  cards: Array<{id: string, name: string, set_code: string, collector_number?: string}>,
  log: string[],
  errors: string[]
): Promise<Array<{id: string, name: string, italian_name?: string, source_url?: string}>> {
  const results: Array<{id: string, name: string, italian_name?: string, source_url?: string}> = []
  let queriesCount = 0
  
  // Raggruppa per set per ottimizzare le query
  const cardsBySet = groupCardsBySet(cards)
  
  for (const [setCode, setCards] of Object.entries(cardsBySet)) {
    log.push(`Processing set ${setCode}: ${setCards.length} cards`)
    
    for (const card of setCards) {
      try {
        const translationData = await findArenaZoneTranslation(card.name, setCode)
        queriesCount++
        
        results.push({
          id: card.id,
          name: card.name,
          italian_name: translationData?.italian_name,
          source_url: translationData?.source_url
        })
        
        if (translationData?.italian_name) {
          log.push(`Found Arena Zone IT: ${card.name} -> ${translationData.italian_name}`)
        }
        
        await sleep(RATE_LIMIT_DELAY)
        
        // Progress logging
        if (results.length % 25 === 0) {
          log.push(`Arena Zone search progress: ${results.length}/${cards.length}`)
        }
        
      } catch (error) {
        errors.push(`Error searching Arena Zone for ${card.name}: ${(error as Error).message}`)
        results.push({
          id: card.id,
          name: card.name
        })
      }
    }
  }
  
  const foundCount = results.filter(r => r.italian_name).length
  log.push(`Arena Zone search completed: ${foundCount}/${cards.length} translations found`)
  
  return results
}

function groupCardsBySet(cards: Array<{id: string, name: string, set_code: string, collector_number?: string}>): {[setCode: string]: Array<{id: string, name: string, set_code: string, collector_number?: string}>} {
  const grouped: {[setCode: string]: Array<{id: string, name: string, set_code: string, collector_number?: string}>} = {}
  
  cards.forEach(card => {
    if (!grouped[card.set_code]) {
      grouped[card.set_code] = []
    }
    grouped[card.set_code].push(card)
  })
  
  return grouped
}

async function findArenaZoneTranslation(
  cardName: string, 
  setCode?: string
): Promise<{italian_name: string, source_url: string} | undefined> {
  try {
    // Metodo 1: Cerca nella database di carta specifica
    const cardSearchUrl = `${ARENA_ZONE_BASE}/card/${encodeURIComponent(cardName.toLowerCase().replace(/ /g, '-'))}/`
    
    try {
      const cardResponse = await fetch(cardSearchUrl, {
        headers: {
          'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
          'Accept': 'text/html,application/xhtml+xml'
        }
      })
      
      if (cardResponse.ok) {
        const html = await cardResponse.text()
        const italianName = extractItalianNameFromHtml(html, cardName)
        
        if (italianName && italianName !== cardName) {
          return {
            italian_name: italianName,
            source_url: cardSearchUrl
          }
        }
      }
    } catch (error) {
      // Continue to next method
    }
    
    // Metodo 2: Cerca tramite API search se disponibile
    if (setCode) {
      try {
        const apiSearchUrl = `${ARENA_ZONE_API}/cards/search?name=${encodeURIComponent(cardName)}&set=${setCode}&lang=it`
        
        const apiResponse = await fetch(apiSearchUrl, {
          headers: {
            'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
            'Accept': 'application/json'
          }
        })
        
        if (apiResponse.ok) {
          const data = await apiResponse.json()
          
          if (data && data.cards && Array.isArray(data.cards) && data.cards.length > 0) {
            const card = data.cards.find((c: any) => 
              c.name && (c.name_it || c.italian_name || c.localized_name)
            )
            
            if (card) {
              const italianName = card.name_it || card.italian_name || card.localized_name
              if (italianName && italianName !== cardName) {
                return {
                  italian_name: italianName,
                  source_url: apiSearchUrl
                }
              }
            }
          }
        }
      } catch (error) {
        // Continue to next method
      }
    }
    
    // Metodo 3: Cerca nella sezione traduzioni generali
    try {
      const translationsUrl = `${ARENA_ZONE_BASE}/translations/?search=${encodeURIComponent(cardName)}`
      
      const translationResponse = await fetch(translationsUrl, {
        headers: {
          'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
          'Accept': 'text/html'
        }
      })
      
      if (translationResponse.ok) {
        const html = await translationResponse.text()
        const italianName = extractItalianFromTranslationsPage(html, cardName)
        
        if (italianName && italianName !== cardName) {
          return {
            italian_name: italianName,
            source_url: translationsUrl
          }
        }
      }
    } catch (error) {
      // All methods failed
    }
    
    return undefined
    
  } catch (error) {
    // Return undefined per single card failure
    return undefined
  }
}

function extractItalianNameFromHtml(html: string, englishName: string): string | undefined {
  try {
    // Pattern comuni per nomi italiani su Arena Zone
    const patterns = [
      // Meta tag per localizzazione
      /<meta[^>]+name=["']italian[^"']*["'][^>]+content=["']([^"']+)["']/i,
      // Div o span con classe italiana
      /<(?:div|span)[^>]*class=["'][^"']*(?:italian|it-name)[^"']*["'][^>]*>([^<]+)</i,
      // Data attributes
      /data-italian-name=["']([^"']+)["']/i,
      // JSON embedded con traduzioni
      /"italian_name"\s*:\s*"([^"]+)"/i,
      /"name_it"\s*:\s*"([^"]+)"/i,
      // Table row con traduzioni
      /<tr[^>]*>.*?italiano.*?<td[^>]*>([^<]+)</i
    ]
    
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1] && match[1].trim() !== englishName) {
        return match[1].trim()
      }
    }
    
    return undefined
    
  } catch (error) {
    return undefined
  }
}

function extractItalianFromTranslationsPage(html: string, englishName: string): string | undefined {
  try {
    // Cerca nella pagina traduzioni specifiche per la carta
    const cardSectionRegex = new RegExp(
      `${englishName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*<[^>]*>[^<]*([^<]+(?:italiano|italian)[^<]*<[^>]*>([^<]+)|([^<]+))`,
      'i'
    )
    
    const match = html.match(cardSectionRegex)
    if (match) {
      const italianName = match[2] || match[3]
      if (italianName && italianName.trim() !== englishName) {
        return italianName.trim()
      }
    }
    
    // Fallback: cerca pattern tabella traduzioni
    const escapedName = englishName.replace(/[.*+?^${}()|[\]\\]/g, '\\    // Fallback: cerca pattern tabella traduzioni
    const tablePattern = /<table[^>]*>.*?<tr[^>]*>.*?${englishName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?<td[^>]*>([^<]+)/is
    const tableMatch = html.match(tablePattern)')
    const tablePattern = new RegExp(`<table[^>]*>.*?<tr[^>]*>.*?${escapedName}.*?<td[^>]*>([^<]+)`, 'is')
    const tableMatch = html.match(tablePattern)
    
    if (tableMatch && tableMatch[1] && tableMatch[1].trim() !== englishName) {
      return tableMatch[1].trim()
    }
    
    return undefined
    
  } catch (error) {
    return undefined
  }
}

async function updateDatabaseWithArenaZoneTranslations(
  supabase: any,
  translationResults: Array<{id: string, name: string, italian_name?: string, source_url?: string}>,
  log: string[],
  errors: string[]
): Promise<{translations_found: number, queries_made: number}> {
  let translationsFound = 0
  let queriesMade = 0
  
  for (const result of translationResults) {
    queriesMade++
    
    if (!result.italian_name) continue
    
    try {
      const updateData: any = {
        name_it: result.italian_name,
        arena_zone_synced_at: new Date().toISOString()
      }
      
      if (result.source_url) {
        updateData.arena_zone_source = result.source_url
      }
      
      const { error: updateError } = await supabase
        .from('cards')
        .update(updateData)
        .eq('id', result.id)
      
      if (updateError) {
        errors.push(`Failed to update ${result.name}: ${updateError.message}`)
        continue
      }
      
      translationsFound++
      
      // Progress logging
      if (translationsFound % 15 === 0) {
        log.push(`Database update progress: ${translationsFound} Arena Zone translations saved`)
      }
      
    } catch (error) {
      errors.push(`Error updating ${result.name}: ${(error as Error).message}`)
    }
  }
  
  return { translations_found: translationsFound, queries_made: queriesMade }
}

// GET endpoint for import status
export async function GET() {
  return NextResponse.json({
    status: 'MTG Arena Zone Italian Importer',
    data_source: 'MTG Arena Zone Database',
    description: 'Imports Italian card names specifically used in MTG Arena client',
    endpoints: {
      'POST /import': 'Import Italian names from Arena Zone',
      'Parameters': {
        'adminKey': 'Required admin key',
        'maxCards': 'Max cards to process (default: 300)',
        'skipExisting': 'Skip cards with existing Italian names (default: true)', 
        'prioritySets': 'Use priority Arena sets (default: true)',
        'specificSets': 'Array of specific set codes to process (optional)'
      }
    },
    priority_sets: PRIORITY_SETS,
    features: [
      'Searches Arena Zone card database',
      'Extracts Italian translations from HTML',
      'Focuses on Arena-legal cards only',
      'Supports set-specific imports',
      'Multiple extraction methods for reliability'
    ],
    environment_variables_required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NEXT_PUBLIC_ADMIN_KEY'
    ]
  })
}