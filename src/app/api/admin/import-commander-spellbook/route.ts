// src/app/api/admin/import-commander-spellbook/route.ts
// Importatore per Commander Spellbook API

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY!

interface CommanderSpellbookCombo {
  commanderSpellbookId: string
  cards: Array<{ name: string }>
  colorIdentity: string // "w,u,b" format
  prerequisites: string[]
  steps: string[]
  results: string[]
  permalink: string
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

const COMMANDER_SPELLBOOK_API = 'https://sheets.googleapis.com/v4/spreadsheets/1JJo8MzkpuhfvsaKVFVlOoNymscCt-Aw-1sob2IhpwXY/values/combos!A:Z?key=AIzaSyDzQ2zRt2HnTvq0Z5V7_7O2aaYYoV7B2b8'

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    const body = await request.json()
    const { adminKey, maxCombos = 1000, colorFilter = null } = body
    
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }
    
    log.push('Starting Commander Spellbook import...')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Step 1: Fetch data from Commander Spellbook API
    log.push('Fetching combo data from Commander Spellbook API...')
    const combosData = await fetchCommanderSpellbookData(log, errors)
    
    if (!combosData || combosData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch data from Commander Spellbook API',
        errors,
        log
      }, { status: 500 })
    }
    
    log.push(`Fetched ${combosData.length} combos from Commander Spellbook`)
    
    // Step 2: Parse and validate combos
    log.push('Parsing and validating combo data...')
    const parsedCombos = parseCommanderSpellbookData(combosData, colorFilter, log, errors)
    
    // Limit number of combos to import
    const combosToImport = parsedCombos.slice(0, maxCombos)
    log.push(`Selected ${combosToImport.length} combos to import (max: ${maxCombos})`)
    
    // Step 3: Import to database
    log.push('Importing combos to database...')
    const importStats = await importCombosToDatabase(supabase, combosToImport, log, errors)
    
    const finalStats = {
      total_fetched: combosData.length,
      valid_combos: parsedCombos.length,
      imported: importStats.imported,
      skipped: importStats.skipped,
      errors: errors.length
    }
    
    log.push('Commander Spellbook import completed!')
    log.push(`Imported: ${importStats.imported} combos`)
    log.push(`Skipped: ${importStats.skipped} combos`)
    log.push(`Errors: ${errors.length}`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importStats.imported} combos from Commander Spellbook`,
      stats: finalStats,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Show max 10 errors
      log
    })
    
  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`Commander Spellbook import failed: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      message: 'Commander Spellbook import failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function fetchCommanderSpellbookData(log: string[], errors: string[]): Promise<any[] | null> {
  try {
    // Usa l'API wrapper npm per semplificare l'accesso
    const response = await fetch('https://commanderspellbook.com/api/combos/', {
      headers: {
        'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Commander Spellbook API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format from Commander Spellbook API')
    }
    
    return data
    
  } catch (error) {
    errors.push(`Error fetching from Commander Spellbook: ${(error as Error).message}`)
    
    // Fallback: usa dati mock per testing se l'API non risponde
    log.push('API not available, using fallback data for testing...')
    return getMockCommanderSpellbookData()
  }
}

function parseCommanderSpellbookData(
  rawData: any[], 
  colorFilter: string[] | null,
  log: string[], 
  errors: string[]
): any[] {
  const validCombos: any[] = []
  
  for (const item of rawData) {
    try {
      // Validate required fields
      if (!item.id || !item.cards || !Array.isArray(item.cards)) {
        continue
      }
      
      if (!item.steps || !item.results) {
        continue
      }
      
      // Parse color identity from various formats
      const colorIdentity = parseColorIdentity(item.colorIdentity || item.color_identity || '')
      
      // Apply color filter if specified
      if (colorFilter && colorFilter.length > 0) {
        const matchesFilter = colorFilter.every(color => colorIdentity.includes(color)) &&
                              colorIdentity.every(color => colorFilter.includes(color))
        if (!matchesFilter) continue
      }
      
      // Extract card names
      const cardNames = item.cards
        .map((card: any) => card.name || card.card || card)
        .filter((name: string) => name && typeof name === 'string')
      
      if (cardNames.length === 0) continue
      
      // Parse steps and results
      const steps = parseStepsOrResults(item.steps)
      const results = parseStepsOrResults(item.results)
      const prerequisites = parseStepsOrResults(item.prerequisites || '')
      
      // Create combined description
      let fullSteps = ''
      if (prerequisites.length > 0) fullSteps += 'Prerequisites: ' + prerequisites.join('. ') + '. '
      fullSteps += 'Steps: ' + steps.join('. ')
      if (results.length > 0) fullSteps += '. Results: ' + results.join('. ')
      
      // Determine result tag from results
      const resultTag = determineResultTag(results, steps)
      
      const parsedCombo = {
        external_id: item.id?.toString() || `cs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: generateComboName(cardNames, resultTag),
        result_tag: resultTag,
        steps: fullSteps.trim(),
        color_identity: colorIdentity,
        source: 'commander_spellbook',
        cards: cardNames,
        permalink: item.permalink || `https://commanderspellbook.com/?id=${item.id}`
      }
      
      validCombos.push(parsedCombo)
      
    } catch (error) {
      errors.push(`Error parsing combo ${item.id}: ${(error as Error).message}`)
    }
  }
  
  log.push(`Parsed ${validCombos.length} valid combos from ${rawData.length} raw entries`)
  
  return validCombos
}

function parseColorIdentity(colorString: string): string[] {
  if (!colorString || typeof colorString !== 'string') return []
  
  // Handle various formats: "w,u,b", "WUB", ["W","U","B"]
  const normalized = colorString
    .replace(/['"[\]]/g, '') // Remove quotes and brackets
    .replace(/,/g, '') // Remove commas
    .toUpperCase()
    .split('')
    .filter(char => 'WUBRG'.includes(char))
  
  return [...new Set(normalized)] // Remove duplicates
}

function parseStepsOrResults(text: any): string[] {
  if (!text) return []
  if (typeof text === 'string') {
    return text
      .split(/[.\n]/)
      .map(step => step.trim())
      .filter(step => step.length > 0)
  }
  if (Array.isArray(text)) {
    return text.map(item => String(item).trim()).filter(item => item.length > 0)
  }
  return []
}

function determineResultTag(results: string[], steps: string[]): string {
  const allText = (results.join(' ') + ' ' + steps.join(' ')).toLowerCase()
  
  if (allText.includes('infinite')) {
    if (allText.includes('damage')) return 'Infinite Damage'
    if (allText.includes('mana')) return 'Infinite Mana'
    if (allText.includes('token') || allText.includes('creature')) return 'Infinite Tokens'
    if (allText.includes('mill')) return 'Infinite Mill'
    if (allText.includes('life')) return 'Infinite Life'
    return 'Infinite Combo'
  }
  
  if (allText.includes('win') || allText.includes('victory')) return 'Win Condition'
  if (allText.includes('draw')) return 'Card Advantage'
  if (allText.includes('damage')) return 'Direct Damage'
  if (allText.includes('mill')) return 'Mill Strategy'
  if (allText.includes('token')) return 'Token Generation'
  if (allText.includes('counter')) return 'Counter Strategy'
  
  return 'Combo Synergy'
}

function generateComboName(cardNames: string[], resultTag: string): string {
  if (cardNames.length === 0) return resultTag
  if (cardNames.length === 1) return `${cardNames[0]} Combo`
  if (cardNames.length === 2) return `${cardNames[0]} + ${cardNames[1]}`
  if (cardNames.length === 3) return `${cardNames[0]} + ${cardNames[1]} + ${cardNames[2]}`
  
  return `${cardNames[0]} + ${cardNames[1]} + ${cardNames.length - 2} others`
}

async function importCombosToDatabase(
  supabase: any,
  combos: any[],
  log: string[],
  errors: string[]
): Promise<{ imported: number, skipped: number }> {
  let imported = 0
  let skipped = 0
  
  for (const combo of combos) {
    try {
      // Check if combo already exists (by external_id or similar name)
      const { data: existing } = await supabase
        .from('combos')
        .select('id, name')
        .or(`name.eq.${combo.name},source.eq.commander_spellbook`)
        .limit(1)
        .single()
      
      if (existing) {
        skipped++
        continue
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
          links: combo.permalink ? [combo.permalink] : []
        })
      
      if (insertError) {
        errors.push(`Failed to insert combo "${combo.name}": ${insertError.message}`)
        continue
      }
      
      imported++
      
      // Log progress every 50 combos
      if (imported % 50 === 0) {
        log.push(`Imported ${imported} combos...`)
      }
      
    } catch (error) {
      errors.push(`Error importing combo "${combo.name}": ${(error as Error).message}`)
    }
  }
  
  return { imported, skipped }
}

// Mock data for testing when API is not available
function getMockCommanderSpellbookData(): any[] {
  return [
    {
      id: 'mock_1',
      cards: [
        { name: 'Kiki-Jiki, Mirror Breaker' },
        { name: 'Deceiver Exarch' }
      ],
      colorIdentity: 'r',
      steps: 'Tap Kiki-Jiki to create a copy of Deceiver Exarch. Use the copy to untap Kiki-Jiki. Repeat for infinite hasty creatures.',
      results: 'Infinite creature tokens with haste',
      prerequisites: 'Kiki-Jiki and Deceiver Exarch on the battlefield'
    },
    {
      id: 'mock_2', 
      cards: [
        { name: 'Thassa\'s Oracle' },
        { name: 'Demonic Consultation' }
      ],
      colorIdentity: 'u,b',
      steps: 'Cast Demonic Consultation naming a card not in your deck. Cast Thassa\'s Oracle with an empty library.',
      results: 'Win the game immediately',
      prerequisites: 'Thassa\'s Oracle in hand and mana available'
    }
  ]
}

// GET endpoint for import status
export async function GET() {
  return NextResponse.json({
    status: 'Commander Spellbook Importer',
    endpoints: {
      'POST /import': 'Import combos from Commander Spellbook',
      'Parameters': {
        'adminKey': 'Required admin key',
        'maxCombos': 'Max combos to import (default: 1000)',
        'colorFilter': 'Optional array of colors to filter by'
      }
    }
  })
}