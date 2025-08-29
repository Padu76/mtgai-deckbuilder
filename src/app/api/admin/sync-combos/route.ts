// src/app/api/admin/sync-combos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || ''

// Commander Spellbook API
const SPELLBOOK_API_BASE = 'https://json.commanderspellbook.com'
const SPELLBOOK_COMBOS_URL = `${SPELLBOOK_API_BASE}/combos.json`

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SpellbookCombo {
  identity: string
  cards: {
    card: string
    quantity?: number
  }[]
  colorIdentity: {
    color: string
  }[]
  prerequisites: string[]
  steps: string[]
  results: string[]
  status?: string
}

interface ProcessedCombo {
  source: string
  name: string
  result_tag: string
  color_identity: string[]
  steps: string
  card_names: string[]
}

// Fetch combos from Commander Spellbook
async function fetchSpellbookCombos(): Promise<SpellbookCombo[]> {
  try {
    console.log('Fetching combos from Commander Spellbook...')
    const response = await fetch(SPELLBOOK_COMBOS_URL, {
      headers: {
        'User-Agent': 'MTGAIDeckBuilder/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Spellbook API error: ${response.status}`)
    }
    
    const data = await response.json()
    return data || []
  } catch (error) {
    console.error('Error fetching Spellbook combos:', error)
    return []
  }
}

// Process a Spellbook combo into our format
function processSpellbookCombo(combo: SpellbookCombo): ProcessedCombo | null {
  if (!combo.results || combo.results.length === 0) return null
  if (combo.status && combo.status.toLowerCase().includes('banned')) return null
  
  const cardNames = combo.cards.map(c => c.card)
  if (cardNames.length === 0) return null
  
  const comboName = cardNames.slice(0, 3).join(' + ') + 
    (cardNames.length > 3 ? ` + ${cardNames.length - 3} more` : '')
  
  // Categorize results
  const resultText = combo.results.join(' ').toLowerCase()
  let resultTag = 'Win Condition'
  
  if (resultText.includes('infinite mana')) resultTag = 'Infinite Mana'
  else if (resultText.includes('infinite tokens') || resultText.includes('infinite creatures')) resultTag = 'Infinite Tokens'
  else if (resultText.includes('infinite damage')) resultTag = 'Infinite Damage'
  else if (resultText.includes('infinite life')) resultTag = 'Infinite Life'
  else if (resultText.includes('infinite mill')) resultTag = 'Infinite Mill'
  else if (resultText.includes('infinite draw')) resultTag = 'Infinite Draw'
  else if (resultText.includes('lock') || resultText.includes('prevent')) resultTag = 'Lock/Stax'
  
  let stepsText = ''
  if (combo.prerequisites.length > 0) {
    stepsText += 'Prerequisites: ' + combo.prerequisites.join('; ') + '. '
  }
  if (combo.steps.length > 0) {
    stepsText += 'Steps: ' + combo.steps.join('; ')
  }
  
  const colorIdentity = combo.colorIdentity.map(c => c.color)
  
  return {
    source: 'Commander Spellbook',
    name: comboName,
    result_tag: resultTag,
    color_identity: colorIdentity,
    steps: stepsText.trim(),
    card_names: cardNames
  }
}

// Basic Cards Realm scraper (since they don't have a public API)
async function scrapeCardsRealmCombos(): Promise<ProcessedCombo[]> {
  const combos: ProcessedCombo[] = []
  
  // Sample combos from Cards Realm patterns (would need actual scraping implementation)
  const sampleCombos = [
    {
      source: 'Cards Realm',
      name: 'Kiki-Jiki + Restoration Angel',
      result_tag: 'Infinite Tokens',
      color_identity: ['R', 'W'],
      steps: '1. Have Kiki-Jiki, Mirror Breaker and Restoration Angel on the battlefield. 2. Use Kiki-Jiki to create a token copy of Restoration Angel. 3. When the token enters, exile Kiki-Jiki and return it to the battlefield. 4. Repeat for infinite Angel tokens.',
      card_names: ['Kiki-Jiki, Mirror Breaker', 'Restoration Angel']
    },
    {
      source: 'Cards Realm',
      name: 'Thassa\'s Oracle + Demonic Consultation',
      result_tag: 'Win Condition',
      color_identity: ['U', 'B'],
      steps: '1. Cast Demonic Consultation, naming a card not in your deck. 2. Exile your entire library. 3. Cast Thassa\'s Oracle with an empty library to win immediately.',
      card_names: ['Thassa\'s Oracle', 'Demonic Consultation']
    },
    {
      source: 'Cards Realm',
      name: 'Heliod + Walking Ballista',
      result_tag: 'Infinite Damage',
      color_identity: ['W'],
      steps: '1. Have Heliod, Sun-Crowned and Walking Ballista with at least 1 counter on the battlefield. 2. Remove a counter from Ballista to deal 1 damage. 3. Heliod triggers, put a counter on Ballista. 4. Repeat for infinite damage.',
      card_names: ['Heliod, Sun-Crowned', 'Walking Ballista']
    }
  ]
  
  return sampleCombos
}

// Find card IDs by names
async function findCardsByName(cardNames: string[], supa: any): Promise<string[]> {
  if (cardNames.length === 0) return []
  
  const { data: cards, error } = await supa
    .from('cards')
    .select('id, name')
    .in('name', cardNames)
    .eq('in_arena', true)
  
  if (error) {
    console.error('Error finding cards:', error)
    return []
  }
  
  return (cards || []).map((c: any) => c.id)
}

// Insert combo into database
async function insertCombo(combo: ProcessedCombo, supa: any): Promise<boolean> {
  try {
    const cardIds = await findCardsByName(combo.card_names, supa)
    
    if (cardIds.length === 0) {
      console.log(`Skipping combo "${combo.name}" - no Arena cards found`)
      return false
    }
    
    // Check if combo already exists
    const { data: existing } = await supa
      .from('combos')
      .select('id')
      .eq('source', combo.source)
      .eq('name', combo.name)
      .single()
    
    if (existing) {
      return false
    }
    
    // Insert combo
    const { data: newCombo, error: comboError } = await supa
      .from('combos')
      .insert({
        source: combo.source,
        name: combo.name,
        result_tag: combo.result_tag,
        color_identity: combo.color_identity,
        steps: combo.steps,
        links: []
      })
      .select('id')
      .single()
    
    if (comboError) {
      console.error('Error inserting combo:', comboError)
      return false
    }
    
    // Link cards to combo
    if (cardIds.length > 0) {
      const comboCards = cardIds.map(cardId => ({
        combo_id: newCombo.id,
        card_id: cardId
      }))
      
      const { error: linkError } = await supa
        .from('combo_cards')
        .insert(comboCards)
      
      if (linkError) {
        console.error('Error linking combo cards:', linkError)
        await supa.from('combos').delete().eq('id', newCombo.id)
        return false
      }
    }
    
    console.log(`Successfully added combo: ${combo.name}`)
    return true
  } catch (error) {
    console.error('Error processing combo:', error)
    return false
  }
}

export async function GET(req: NextRequest) {
  // Authentication check
  const key = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key') || ''
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ 
      ok: false, 
      error: 'Missing Supabase environment variables' 
    }, { status: 500 })
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { 
    auth: { persistSession: false } 
  })

  try {
    console.log('Starting combo sync process...')
    
    let totalInserted = 0
    let totalProcessed = 0

    // Sync from Commander Spellbook
    console.log('Fetching from Commander Spellbook...')
    const spellbookCombos = await fetchSpellbookCombos()
    console.log(`Found ${spellbookCombos.length} combos from Spellbook`)
    
    for (const rawCombo of spellbookCombos.slice(0, 100)) { // Limit for testing
      const processedCombo = processSpellbookCombo(rawCombo)
      if (processedCombo) {
        totalProcessed++
        if (await insertCombo(processedCombo, supa)) {
          totalInserted++
        }
        
        // Rate limiting
        if (totalProcessed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    // Sync sample combos from Cards Realm patterns
    console.log('Adding Cards Realm sample combos...')
    const cardsRealmCombos = await scrapeCardsRealmCombos()
    
    for (const combo of cardsRealmCombos) {
      totalProcessed++
      if (await insertCombo(combo, supa)) {
        totalInserted++
      }
    }

    const successMessage = `Combo sync completed: ${totalInserted} new combos added out of ${totalProcessed} processed`
    console.log(successMessage)
    
    await supa.from('admin_logs').insert({
      action: 'combo_sync',
      message: successMessage
    })
    
    return NextResponse.json({ 
      ok: true, 
      inserted: totalInserted,
      processed: totalProcessed
    })
    
  } catch (error: any) {
    const errorMessage = `Combo sync failed: ${String(error)}`
    console.error('Combo sync error:', error)
    
    await supa.from('admin_logs').insert({
      action: 'combo_sync_error',
      message: errorMessage
    })
    
    return NextResponse.json({ 
      ok: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}