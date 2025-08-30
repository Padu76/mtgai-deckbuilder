// src/app/api/admin/import-edhrec-historic/route.ts
// Importatore EDHREC per Historic Brawl Combos

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY!

interface EDHRECCombo {
  id: string
  name: string
  cards: Array<{ name: string; synergy_score?: number }>
  colors: string[]
  commander?: string
  theme: string
  description: string
  popularity: number
  winrate?: number
  url: string
}

interface ImportResult {
  success: boolean
  message: string
  stats?: {
    commanders_analyzed: number
    total_combos_found: number
    historic_legal_combos: number
    imported: number
    skipped: number
    errors: number
    color_breakdown: { [key: string]: number }
    theme_breakdown: { [key: string]: number }
  }
  log?: string[]
  errors?: string[]
}

// EDHREC API endpoints
const EDHREC_BASE = 'https://json.edhrec.com'
const HISTORIC_BRAWL_LEGAL_COMMANDERS = [
  'Jace, Vryn\'s Prodigy',
  'Chandra, Fire of Kaladesh',
  'Kytheon, Hero of Akros',
  'Nissa, Vastwood Seer',
  'Liliana, Heretical Healer',
  // Aggiungeremo dinamicamente altri commander Historic legali
]

const COMBO_THEMES = [
  'combo',
  'infinite-combo',
  'storm',
  'voltron',
  'artifacts',
  'enchantments',
  'spellslinger',
  'graveyard',
  'tokens'
]

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    const body = await request.json()
    const { 
      adminKey, 
      maxCombos = 150,
      colorFilter = null,
      skipExisting = true,
      includeUnpopular = false
    } = body
    
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }
    
    log.push('Starting EDHREC Historic Brawl import...')
    log.push(`Target: ${maxCombos} combos from EDHREC database`)
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Step 1: Fetch Historic Brawl legal commanders
    log.push('Fetching Historic Brawl legal commanders...')
    const historicCommanders = await fetchHistoricLegalCommanders(log, errors)
    
    // Step 2: Fetch combo data from EDHREC
    log.push('Fetching combo data from EDHREC...')
    const combosData = await fetchEDHRECCombos(historicCommanders, maxCombos, colorFilter, includeUnpopular, log, errors)
    
    if (!combosData || combosData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Historic Brawl combos found on EDHREC',
        errors,
        log
      }, { status: 500 })
    }
    
    log.push(`Found ${combosData.length} Historic Brawl compatible combos from EDHREC`)
    
    // Step 3: Parse and validate combos
    log.push('Processing and validating combo data...')
    const parsedCombos = processEDHRECCombos(combosData, log, errors)
    
    // Step 4: Import to database
    log.push('Importing combos to database...')
    const importStats = await importCombosToDatabase(supabase, parsedCombos, skipExisting, log, errors)
    
    const finalStats = {
      commanders_analyzed: historicCommanders.length,
      total_combos_found: combosData.length,
      historic_legal_combos: parsedCombos.length,
      imported: importStats.imported,
      skipped: importStats.skipped,
      errors: errors.length,
      color_breakdown: calculateColorBreakdown(parsedCombos),
      theme_breakdown: calculateThemeBreakdown(parsedCombos)
    }
    
    log.push('EDHREC Historic Brawl import completed!')
    log.push(`Commanders analyzed: ${historicCommanders.length}`)
    log.push(`Imported: ${importStats.imported} combos`)
    log.push(`Skipped: ${importStats.skipped} combos`)
    log.push(`Errors: ${errors.length}`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importStats.imported} Historic Brawl combos from EDHREC`,
      stats: finalStats,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      log
    })
    
  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`EDHREC import failed: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      message: 'EDHREC Historic Brawl import failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function fetchHistoricLegalCommanders(log: string[], errors: string[]): Promise<string[]> {
  const commanders: string[] = []
  
  try {
    // Prima usa la lista predefinita
    commanders.push(...HISTORIC_BRAWL_LEGAL_COMMANDERS)
    
    // Poi cerca dinamicamente commander Historic-legal via Scryfall
    const scryfallResponse = await fetch('https://api.scryfall.com/cards/search?q=format:historic%20is:commander%20game:arena', {
      headers: {
        'User-Agent': 'MTGArenaAI-DeckBuilder/1.0'
      }
    })
    
    if (scryfallResponse.ok) {
      const data = await scryfallResponse.json()
      if (data.data && Array.isArray(data.data)) {
        const additionalCommanders = data.data
          .map((card: any) => card.name)
          .filter((name: string) => !commanders.includes(name))
        
        commanders.push(...additionalCommanders.slice(0, 50)) // Limit per performance
        log.push(`Found ${additionalCommanders.length} additional Historic commanders via Scryfall`)
      }
    }
    
    log.push(`Total Historic Brawl legal commanders: ${commanders.length}`)
    return commanders
    
  } catch (error) {
    errors.push(`Error fetching Historic commanders: ${(error as Error).message}`)
    log.push('Using predefined commander list as fallback')
    return HISTORIC_BRAWL_LEGAL_COMMANDERS
  }
}

async function fetchEDHRECCombos(
  commanders: string[],
  maxCombos: number,
  colorFilter: string[] | null,
  includeUnpopular: boolean,
  log: string[],
  errors: string[]
): Promise<EDHRECCombo[]> {
  const allCombos: EDHRECCombo[] = []
  
  try {
    // Fetch combo themes from EDHREC
    for (const theme of COMBO_THEMES) {
      if (allCombos.length >= maxCombos) break
      
      try {
        const response = await fetch(`${EDHREC_BASE}/themes/${theme}.json`, {
          headers: {
            'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
            'Accept': 'application/json'
          }
        })
        
        if (!response.ok) {
          log.push(`Theme ${theme} not available on EDHREC`)
          continue
        }
        
        const themeData = await response.json()
        const themeCombos = await extractCombosFromTheme(themeData, theme, commanders, colorFilter, includeUnpopular, log)
        
        allCombos.push(...themeCombos)
        log.push(`Found ${themeCombos.length} combos from theme: ${theme}`)
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error) {
        errors.push(`Error fetching theme ${theme}: ${(error as Error).message}`)
      }
    }
    
    // Fetch specific commander combos
    for (const commander of commanders.slice(0, 20)) { // Limit per performance
      if (allCombos.length >= maxCombos) break
      
      try {
        const commanderSlug = commander.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const response = await fetch(`${EDHREC_BASE}/commanders/${commanderSlug}.json`, {
          headers: {
            'User-Agent': 'MTGArenaAI-DeckBuilder/1.0'
          }
        })
        
        if (response.ok) {
          const commanderData = await response.json()
          const commanderCombos = await extractCombosFromCommander(commanderData, commander, colorFilter, log)
          
          allCombos.push(...commanderCombos)
          log.push(`Found ${commanderCombos.length} combos for commander: ${commander}`)
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        errors.push(`Error fetching commander ${commander}: ${(error as Error).message}`)
      }
    }
    
    // Remove duplicates and sort by popularity
    const uniqueCombos = removeDuplicateCombos(allCombos)
    const sortedCombos = uniqueCombos
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, maxCombos)
    
    log.push(`Total unique combos after deduplication: ${sortedCombos.length}`)
    return sortedCombos
    
  } catch (error) {
    errors.push(`Error in fetchEDHRECCombos: ${(error as Error).message}`)
    return []
  }
}

async function extractCombosFromTheme(
  themeData: any,
  theme: string,
  commanders: string[],
  colorFilter: string[] | null,
  includeUnpopular: boolean,
  log: string[]
): Promise<EDHRECCombo[]> {
  const combos: EDHRECCombo[] = []
  
  try {
    if (!themeData.cardlists || !Array.isArray(themeData.cardlists)) {
      return combos
    }
    
    // Cerca sezioni combo nelle cardlist
    const comboSections = themeData.cardlists.filter((section: any) => 
      section.header && (
        section.header.toLowerCase().includes('combo') ||
        section.header.toLowerCase().includes('synergy') ||
        section.header.toLowerCase().includes('infinite')
      )
    )
    
    for (const section of comboSections) {
      if (!section.cardviews || !Array.isArray(section.cardviews)) continue
      
      // Analizza carte per trovare combo
      const sectionCards = section.cardviews
        .filter((card: any) => card.num_decks && (includeUnpopular || card.num_decks > 50))
      
      // Crea combo da coppie di carte sinergiche
      for (let i = 0; i < sectionCards.length - 1; i++) {
        for (let j = i + 1; j < sectionCards.length && j < i + 3; j++) {
          const combo = createComboFromCards([sectionCards[i], sectionCards[j]], theme, colorFilter)
          if (combo) combos.push(combo)
        }
      }
    }
    
    return combos
    
  } catch (error) {
    log.push(`Error extracting combos from theme ${theme}: ${(error as Error).message}`)
    return []
  }
}

async function extractCombosFromCommander(
  commanderData: any,
  commander: string,
  colorFilter: string[] | null,
  log: string[]
): Promise<EDHRECCombo[]> {
  const combos: EDHRECCombo[] = []
  
  try {
    if (!commanderData.cardlists) return combos
    
    // Cerca sezioni high synergy e combo
    const relevantSections = commanderData.cardlists.filter((section: any) =>
      section.header && (
        section.header.toLowerCase().includes('high synergy') ||
        section.header.toLowerCase().includes('combo') ||
        section.header.toLowerCase().includes('signature')
      )
    )
    
    for (const section of relevantSections) {
      if (!section.cardviews) continue
      
      const highSynergyCards = section.cardviews
        .filter((card: any) => card.synergy_score && card.synergy_score > 0.3)
        .slice(0, 10) // Top synergy cards
      
      // Crea combo con il commander
      for (const card of highSynergyCards) {
        const combo = createCommanderCombo(commander, card, commanderData.colors, colorFilter)
        if (combo) combos.push(combo)
      }
    }
    
    return combos
    
  } catch (error) {
    log.push(`Error extracting combos from commander ${commander}: ${(error as Error).message}`)
    return []
  }
}

function createComboFromCards(cards: any[], theme: string, colorFilter: string[] | null): EDHRECCombo | null {
  if (!cards || cards.length < 2) return null
  
  const cardNames = cards.map(c => c.name).filter(Boolean)
  if (cardNames.length < 2) return null
  
  // Determina colori della combo
  const allColors = cards.flatMap(c => c.colors || [])
  const uniqueColors = [...new Set(allColors)]
  
  // Applica filtro colori se specificato
  if (colorFilter && colorFilter.length > 0) {
    const matchesFilter = colorFilter.every(color => uniqueColors.includes(color)) &&
                          uniqueColors.every(color => colorFilter.includes(color))
    if (!matchesFilter) return null
  }
  
  const popularity = Math.max(...cards.map(c => c.num_decks || 0))
  const resultTag = determineResultTagFromTheme(theme)
  
  return {
    id: `edhrec_${theme}_${cards.map(c => c.name).join('_').replace(/[^a-zA-Z0-9]/g, '')}`,
    name: generateComboName(cardNames, resultTag),
    cards: cardNames.map(name => ({ name })),
    colors: uniqueColors,
    theme: theme,
    description: `${cardNames.join(' + ')} creates powerful synergies in the ${theme} archetype.`,
    popularity: popularity,
    url: `https://edhrec.com/themes/${theme}`
  }
}

function createCommanderCombo(commander: string, card: any, commanderColors: string[], colorFilter: string[] | null): EDHRECCombo | null {
  if (!card.name || !card.synergy_score) return null
  
  const comboColors = [...new Set([...commanderColors, ...(card.colors || [])])]
  
  if (colorFilter && colorFilter.length > 0) {
    const matchesFilter = colorFilter.every(color => comboColors.includes(color)) &&
                          comboColors.every(color => colorFilter.includes(color))
    if (!matchesFilter) return null
  }
  
  const resultTag = card.synergy_score > 0.5 ? 'High Synergy Combo' : 'Commander Synergy'
  
  return {
    id: `edhrec_commander_${commander.replace(/[^a-zA-Z0-9]/g, '')}_${card.name.replace(/[^a-zA-Z0-9]/g, '')}`,
    name: `${commander} + ${card.name}`,
    cards: [{ name: commander }, { name: card.name }],
    colors: comboColors,
    commander: commander,
    theme: 'commander-synergy',
    description: `${commander} synergizes exceptionally well with ${card.name} (synergy score: ${card.synergy_score.toFixed(2)}).`,
    popularity: card.num_decks || 0,
    winrate: card.synergy_score,
    url: `https://edhrec.com/commanders/${commander.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  }
}

function determineResultTagFromTheme(theme: string): string {
  switch (theme.toLowerCase()) {
    case 'combo':
    case 'infinite-combo':
      return 'Infinite Combo'
    case 'storm':
      return 'Storm Strategy'
    case 'voltron':
      return 'Voltron Strategy'
    case 'artifacts':
      return 'Artifact Synergy'
    case 'enchantments':
      return 'Enchantment Synergy'
    case 'spellslinger':
      return 'Spellslinger Combo'
    case 'graveyard':
      return 'Graveyard Synergy'
    case 'tokens':
      return 'Token Generation'
    default:
      return 'Historic Brawl Synergy'
  }
}

function generateComboName(cardNames: string[], resultTag: string): string {
  if (cardNames.length === 0) return resultTag
  if (cardNames.length === 1) return `${cardNames[0]} Historic Combo`
  if (cardNames.length === 2) return `${cardNames[0]} + ${cardNames[1]}`
  if (cardNames.length === 3) return `${cardNames[0]} + ${cardNames[1]} + ${cardNames[2]}`
  
  return `${cardNames[0]} + ${cardNames[1]} + ${cardNames.length - 2} others`
}

function removeDuplicateCombos(combos: EDHRECCombo[]): EDHRECCombo[] {
  const seen = new Set<string>()
  return combos.filter(combo => {
    const key = combo.cards.map(c => c.name).sort().join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function processEDHRECCombos(combos: EDHRECCombo[], log: string[], errors: string[]): any[] {
  const processed: any[] = []
  
  for (const combo of combos) {
    try {
      if (!combo.cards || combo.cards.length === 0) continue
      
      const cardNames = combo.cards.map(c => c.name).filter(Boolean)
      if (cardNames.length === 0) continue
      
      processed.push({
        external_id: combo.id,
        name: combo.name,
        result_tag: determineResultTagFromTheme(combo.theme),
        steps: combo.description,
        color_identity: combo.colors || [],
        source: 'edhrec_historic',
        format: 'Historic Brawl',
        popularity: combo.popularity,
        commander: combo.commander,
        theme: combo.theme,
        cards: cardNames,
        permalink: combo.url
      })
    } catch (error) {
      errors.push(`Error processing combo ${combo.id}: ${(error as Error).message}`)
    }
  }
  
  log.push(`Processed ${processed.length} valid EDHREC combos for Historic Brawl`)
  return processed
}

function calculateColorBreakdown(combos: any[]): { [key: string]: number } {
  const breakdown: { [key: string]: number } = {}
  
  combos.forEach(combo => {
    const colors = combo.color_identity || []
    const colorKey = colors.length === 0 ? 'Colorless' : 
                    colors.length === 1 ? `Mono${colors[0]}` :
                    colors.sort().join('')
    breakdown[colorKey] = (breakdown[colorKey] || 0) + 1
  })
  
  return breakdown
}

function calculateThemeBreakdown(combos: any[]): { [key: string]: number } {
  const breakdown: { [key: string]: number } = {}
  
  combos.forEach(combo => {
    const theme = combo.theme || 'unknown'
    breakdown[theme] = (breakdown[theme] || 0) + 1
  })
  
  return breakdown
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
        const { data: existing } = await supabase
          .from('combos')
          .select('id')
          .eq('source', 'edhrec_historic')
          .eq('name', combo.name)
          .single()
        
        if (existing) {
          skipped++
          continue
        }
      }
      
      const { error: insertError } = await supabase
        .from('combos')
        .insert({
          name: combo.name,
          result_tag: combo.result_tag,
          steps: combo.steps,
          color_identity: combo.color_identity,
          source: combo.source,
          format: combo.format,
          popularity: combo.popularity,
          commander: combo.commander,
          theme: combo.theme,
          links: combo.permalink ? [combo.permalink] : []
        })
      
      if (insertError) {
        errors.push(`Failed to insert combo "${combo.name}": ${insertError.message}`)
        continue
      }
      
      imported++
      
      if (imported % 25 === 0) {
        log.push(`Imported ${imported} EDHREC combos...`)
      }
      
    } catch (error) {
      errors.push(`Error importing combo "${combo.name}": ${(error as Error).message}`)
    }
  }
  
  return { imported, skipped }
}

export async function GET() {
  return NextResponse.json({
    status: 'EDHREC Historic Brawl Importer',
    format: 'Historic Brawl (MTG Arena)',
    data_source: 'EDHREC Community Database',
    endpoints: {
      'POST /import': 'Import Historic Brawl combos from EDHREC',
      'Parameters': {
        'adminKey': 'Required admin key',
        'maxCombos': 'Max combos to import (default: 150)',
        'colorFilter': 'Optional array of colors to filter by',
        'skipExisting': 'Skip already imported combos (default: true)',
        'includeUnpopular': 'Include unpopular combos (default: false)'
      }
    },
    supported_themes: COMBO_THEMES,
    environment_variables_required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NEXT_PUBLIC_ADMIN_KEY'
    ]
  })
}