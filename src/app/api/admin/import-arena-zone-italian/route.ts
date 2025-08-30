// src/app/api/admin/import-arena-zone-italian/route.ts
// Importatore MTG Arena Zone per nomi italiani specifici Arena - FIXED VERSION

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY!

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

const ARENA_ZONE_BASE = 'https://mtgazone.com'
const RATE_LIMIT_DELAY = 200

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const PRIORITY_SETS = [
  'BRO', 'DMU', 'SNC', 'NEO', 'VOW', 'MID', 'AFR', 'STX', 
  'KHM', 'ZNR', 'M21', 'IKO', 'THB', 'ELD', 'M20', 'WAR'
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
      prioritySets = true
    } = body
    
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }
    
    log.push('Starting MTG Arena Zone Italian import...')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get cards without Italian names
    const cardsToProcess = await getArenaCardsWithoutItalian(
      supabase, 
      maxCards, 
      prioritySets ? PRIORITY_SETS : null,
      log
    )
    
    if (cardsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Arena cards need Italian translation',
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
    
    // Search translations
    const translationResults = await searchArenaZoneTranslations(cardsToProcess, log, errors)
    
    // Update database
    const updateStats = await updateDatabaseWithTranslations(supabase, translationResults, log, errors)
    
    const coverageImprovement = cardsToProcess.length > 0 
      ? ((updateStats.translations_found / cardsToProcess.length) * 100).toFixed(1) + '%'
      : '0%'
    
    const setsProcessed = [...new Set(cardsToProcess.map(c => c.set_code))]
    
    const finalStats = {
      cards_processed: cardsToProcess.length,
      cards_with_existing_italian: 0,
      new_italian_translations: updateStats.translations_found,
      arena_zone_queries: updateStats.queries_made,
      errors: errors.length,
      coverage_improvement: coverageImprovement,
      sets_processed: setsProcessed
    }
    
    log.push('Arena Zone import completed!')
    log.push(`Found ${updateStats.translations_found} Italian translations`)
    
    return NextResponse.json({
      success: true,
      message: `Found ${updateStats.translations_found} Italian translations from Arena Zone`,
      stats: finalStats,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      log
    })
    
  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      message: 'Arena Zone import failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function getArenaCardsWithoutItalian(
  supabase: any, 
  maxCards: number,
  prioritySets: string[] | null,
  log: string[]
): Promise<Array<{id: string, name: string, set_code: string}>> {
  let query = supabase
    .from('cards')
    .select('id, name, set_code')
    .eq('in_arena', true)
    .or('name_it.is.null,name_it.eq.')
    .not('name', 'is', null)
    .limit(maxCards)
  
  if (prioritySets && prioritySets.length > 0) {
    query = query.in('set_code', prioritySets)
    log.push(`Using priority Arena sets`)
  }
  
  query = query.order('set_code', { ascending: false }).order('name')
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Failed to load Arena cards: ${error.message}`)
  }
  
  return data || []
}

async function searchArenaZoneTranslations(
  cards: Array<{id: string, name: string, set_code: string}>,
  log: string[],
  errors: string[]
): Promise<Array<{id: string, name: string, italian_name?: string}>> {
  const results: Array<{id: string, name: string, italian_name?: string}> = []
  let queriesCount = 0
  
  for (const card of cards) {
    try {
      const italianName = await findArenaZoneTranslation(card.name)
      queriesCount++
      
      results.push({
        id: card.id,
        name: card.name,
        italian_name: italianName
      })
      
      if (italianName) {
        log.push(`Found: ${card.name} -> ${italianName}`)
      }
      
      await sleep(RATE_LIMIT_DELAY)
      
      if (results.length % 25 === 0) {
        log.push(`Progress: ${results.length}/${cards.length}`)
      }
      
    } catch (error) {
      errors.push(`Error searching ${card.name}: ${(error as Error).message}`)
      results.push({
        id: card.id,
        name: card.name
      })
    }
  }
  
  const foundCount = results.filter(r => r.italian_name).length
  log.push(`Search completed: ${foundCount}/${cards.length} translations found`)
  
  return results
}

async function findArenaZoneTranslation(cardName: string): Promise<string | undefined> {
  try {
    const cardSlug = cardName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const searchUrl = `${ARENA_ZONE_BASE}/card/${cardSlug}/`
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
        'Accept': 'text/html'
      }
    })
    
    if (!response.ok) {
      return undefined
    }
    
    const html = await response.text()
    return extractItalianName(html, cardName)
    
  } catch (error) {
    return undefined
  }
}

function extractItalianName(html: string, englishName: string): string | undefined {
  try {
    // Pattern per meta tags italiani
    const metaPattern = /<meta[^>]+name=["']italian[^"']*["'][^>]+content=["']([^"']+)["']/i
    const metaMatch = html.match(metaPattern)
    if (metaMatch && metaMatch[1] && metaMatch[1] !== englishName) {
      return metaMatch[1].trim()
    }
    
    // Pattern per div/span italiani
    const divPattern = /<(?:div|span)[^>]*class=["'][^"']*(?:italian|it-name)[^"']*["'][^>]*>([^<]+)</i
    const divMatch = html.match(divPattern)
    if (divMatch && divMatch[1] && divMatch[1] !== englishName) {
      return divMatch[1].trim()
    }
    
    // Pattern per JSON embedded
    const jsonPattern = /"(?:italian_name|name_it)"\s*:\s*"([^"]+)"/i
    const jsonMatch = html.match(jsonPattern)
    if (jsonMatch && jsonMatch[1] && jsonMatch[1] !== englishName) {
      return jsonMatch[1].trim()
    }
    
    return undefined
    
  } catch (error) {
    return undefined
  }
}

async function updateDatabaseWithTranslations(
  supabase: any,
  translationResults: Array<{id: string, name: string, italian_name?: string}>,
  log: string[],
  errors: string[]
): Promise<{translations_found: number, queries_made: number}> {
  let translationsFound = 0
  let queriesMade = 0
  
  for (const result of translationResults) {
    queriesMade++
    
    if (!result.italian_name) continue
    
    try {
      const { error: updateError } = await supabase
        .from('cards')
        .update({ 
          name_it: result.italian_name,
          arena_zone_synced_at: new Date().toISOString()
        })
        .eq('id', result.id)
      
      if (updateError) {
        errors.push(`Failed to update ${result.name}: ${updateError.message}`)
        continue
      }
      
      translationsFound++
      
      if (translationsFound % 15 === 0) {
        log.push(`Updated ${translationsFound} translations`)
      }
      
    } catch (error) {
      errors.push(`Error updating ${result.name}: ${(error as Error).message}`)
    }
  }
  
  return { translations_found: translationsFound, queries_made: queriesMade }
}

export async function GET() {
  return NextResponse.json({
    status: 'MTG Arena Zone Italian Importer',
    data_source: 'MTG Arena Zone Database',
    priority_sets: PRIORITY_SETS,
    environment_variables_required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NEXT_PUBLIC_ADMIN_KEY'
    ]
  })
}