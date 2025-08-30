// src/app/api/admin/import-gatherer-italian/route.ts
// Importatore Gatherer Wizards per nomi italiani MTG

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY!

interface GathererCard {
  multiverseid: number
  name: string
  names?: string[] // For double-faced cards
  manaCost?: string
  convertedManaCost?: number
  colors?: string[]
  colorIdentity?: string[]
  type: string
  types?: string[]
  subtypes?: string[]
  text?: string
  flavor?: string
  power?: string
  toughness?: string
  loyalty?: string
  rarity: string
  set: string
  setName: string
  artist?: string
  number?: string
  layout?: string
  imageUrl?: string
  language?: string
  printings?: string[]
}

interface ImportResult {
  success: boolean
  message: string
  stats?: {
    cards_processed: number
    cards_with_existing_italian: number
    new_italian_translations: number
    gatherer_queries: number
    errors: number
    coverage_improvement: string
  }
  log?: string[]
  errors?: string[]
}

// Gatherer non ha API REST pubblica, useremo MTG API come proxy
const MTG_API_BASE = 'https://api.magicthegathering.io/v1'
const RATE_LIMIT_DELAY = 150 // MTG API ha rate limit più basso

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    const body = await request.json()
    const { 
      adminKey, 
      maxCards = 200,
      skipExisting = true,
      onlyPopularCards = true 
    } = body
    
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }
    
    log.push('Starting Gatherer Italian names import...')
    log.push(`Target: ${maxCards} cards, skip existing: ${skipExisting}`)
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Step 1: Get cards without Italian names
    log.push('Loading cards without Italian translations...')
    const cardsToProcess = await getCardsWithoutItalian(supabase, maxCards, onlyPopularCards, log)
    
    if (cardsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards need Italian translation from Gatherer',
        stats: {
          cards_processed: 0,
          cards_with_existing_italian: 0,
          new_italian_translations: 0,
          gatherer_queries: 0,
          errors: 0,
          coverage_improvement: '0%'
        },
        log
      })
    }
    
    log.push(`Found ${cardsToProcess.length} cards without Italian names`)
    
    // Step 2: Search Italian translations via MTG API
    log.push('Searching Italian translations via MTG API...')
    const translationResults = await searchItalianTranslations(cardsToProcess, log, errors)
    
    // Step 3: Update database
    log.push('Updating database with Italian translations...')
    const updateStats = await updateDatabaseWithTranslations(supabase, translationResults, log, errors)
    
    const coverageImprovement = cardsToProcess.length > 0 
      ? ((updateStats.translations_found / cardsToProcess.length) * 100).toFixed(1) + '%'
      : '0%'
    
    const finalStats = {
      cards_processed: cardsToProcess.length,
      cards_with_existing_italian: 0, // Already filtered out
      new_italian_translations: updateStats.translations_found,
      gatherer_queries: updateStats.queries_made,
      errors: errors.length,
      coverage_improvement: coverageImprovement
    }
    
    log.push('Gatherer Italian import completed!')
    log.push(`Processed ${cardsToProcess.length} cards`)
    log.push(`Found ${updateStats.translations_found} Italian translations`)
    log.push(`Coverage improvement: ${coverageImprovement}`)
    
    return NextResponse.json({
      success: true,
      message: `Found ${updateStats.translations_found} Italian translations from Gatherer`,
      stats: finalStats,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      log
    })
    
  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`Gatherer import failed: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      message: 'Gatherer Italian import failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function getCardsWithoutItalian(
  supabase: any, 
  maxCards: number,
  onlyPopular: boolean,
  log: string[]
): Promise<Array<{id: string, name: string, set_code: string, collector_number?: string}>> {
  let query = supabase
    .from('cards')
    .select('id, name, set_code, collector_number, in_arena')
    .or('name_it.is.null,name_it.eq.')
    .not('name', 'is', null)
    .limit(maxCards)
  
  if (onlyPopular) {
    // Prioritizza carte Arena per maggiore rilevanza
    query = query.eq('in_arena', true)
    log.push('Filtering to Arena cards only for better relevance')
  }
  
  // Ordina per nome per risultati consistenti
  query = query.order('name')
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Failed to load cards: ${error.message}`)
  }
  
  return data || []
}

async function searchItalianTranslations(
  cards: Array<{id: string, name: string, set_code: string, collector_number?: string}>,
  log: string[],
  errors: string[]
): Promise<Array<{id: string, name: string, italian_name?: string}>> {
  const results: Array<{id: string, name: string, italian_name?: string}> = []
  let queriesCount = 0
  
  for (const card of cards) {
    try {
      // Search by exact name first
      const italianTranslation = await findItalianTranslation(card.name, card.set_code)
      queriesCount++
      
      results.push({
        id: card.id,
        name: card.name,
        italian_name: italianTranslation
      })
      
      if (italianTranslation) {
        log.push(`Found Italian: ${card.name} -> ${italianTranslation}`)
      }
      
      await sleep(RATE_LIMIT_DELAY)
      
      // Progress logging
      if (results.length % 20 === 0) {
        log.push(`Translation search progress: ${results.length}/${cards.length}`)
      }
      
    } catch (error) {
      errors.push(`Error searching translation for ${card.name}: ${(error as Error).message}`)
      results.push({
        id: card.id,
        name: card.name
      })
    }
  }
  
  const foundCount = results.filter(r => r.italian_name).length
  log.push(`Translation search completed: ${foundCount}/${cards.length} translations found`)
  
  return results
}

async function findItalianTranslation(cardName: string, setCode?: string): Promise<string | undefined> {
  try {
    // Query MTG API per carta specifica
    let searchUrl = `${MTG_API_BASE}/cards?name="${encodeURIComponent(cardName)}"`
    if (setCode) {
      searchUrl += `&set=${setCode}`
    }
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'MTGArenaAI-DeckBuilder/1.0'
      }
    })
    
    if (!response.ok) {
      return undefined
    }
    
    const data = await response.json()
    
    if (!data.cards || !Array.isArray(data.cards) || data.cards.length === 0) {
      return undefined
    }
    
    // Cerca versione italiana nelle printing della carta
    for (const card of data.cards) {
      if (card.foreignNames && Array.isArray(card.foreignNames)) {
        const italianVersion = card.foreignNames.find((foreign: any) => 
          foreign.language === 'Italian' || foreign.language === 'Italiano'
        )
        
        if (italianVersion && italianVersion.name && italianVersion.name !== cardName) {
          return italianVersion.name
        }
      }
    }
    
    // Fallback: cerca direttamente carta italiana
    if (!setCode) {
      const italianSearchUrl = `${MTG_API_BASE}/cards?name="${encodeURIComponent(cardName)}"&language=Italian`
      
      const italianResponse = await fetch(italianSearchUrl, {
        headers: {
          'User-Agent': 'MTGArenaAI-DeckBuilder/1.0'
        }
      })
      
      if (italianResponse.ok) {
        const italianData = await italianResponse.json()
        if (italianData.cards && italianData.cards.length > 0) {
          const italianCard = italianData.cards[0]
          if (italianCard.name && italianCard.name !== cardName) {
            return italianCard.name
          }
        }
      }
    }
    
    return undefined
    
  } catch (error) {
    // Silently fail per singola carta per continuare con le altre
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
          gatherer_synced_at: new Date().toISOString()
        })
        .eq('id', result.id)
      
      if (updateError) {
        errors.push(`Failed to update ${result.name}: ${updateError.message}`)
        continue
      }
      
      translationsFound++
      
      // Progress logging
      if (translationsFound % 10 === 0) {
        log.push(`Database update progress: ${translationsFound} translations saved`)
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
    status: 'Gatherer Italian Names Importer',
    data_source: 'MTG API (Gatherer proxy)',
    description: 'Imports Italian card names from Wizards Gatherer database via MTG API',
    endpoints: {
      'POST /import': 'Import Italian names from Gatherer',
      'Parameters': {
        'adminKey': 'Required admin key',
        'maxCards': 'Max cards to process (default: 200)',
        'skipExisting': 'Skip cards with existing Italian names (default: true)', 
        'onlyPopularCards': 'Process only Arena cards (default: true)'
      }
    },
    notes: [
      'Uses MTG API as proxy to access Gatherer data',
      'Focuses on cards missing Italian translations from Scryfall',
      'Rate limited to respect MTG API limits',
      'Complements existing Scryfall sync functionality'
    ],
    environment_variables_required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NEXT_PUBLIC_ADMIN_KEY'
    ]
  })
}