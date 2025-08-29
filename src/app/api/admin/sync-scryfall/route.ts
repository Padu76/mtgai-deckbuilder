// src/app/api/admin/sync-scryfall/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SCRYFALL_BULK_URL = process.env.SCRYFALL_BULK_URL || 'https://api.scryfall.com/cards/search?q=game%3Aarena+unique%3Aprints'
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || ''

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ScryfallCard {
  id: string
  arena_id?: number
  name: string
  mana_value?: number
  mana_cost?: string
  colors?: string[]
  color_identity?: string[]
  type_line?: string
  oracle_text?: string
  set?: string
  collector_number?: string
  rarity?: string
  image_uris?: {
    small?: string
    normal?: string
    large?: string
    art_crop?: string
    border_crop?: string
    png?: string
  }
  legalities?: {
    standard?: string
    historic?: string
    brawl?: string
    historicbrawl?: string
    [key: string]: string | undefined
  }
  games?: string[]
}

interface ProcessedCard {
  scryfall_id: string
  arena_id: number | null
  name: string
  mana_value: number | null
  mana_cost: string | null
  colors: string[]
  color_identity: string[]
  types: string[]
  oracle_text: string | null
  set_code: string | null
  collector_number: string | null
  rarity: string | null
  image_url: string | null
  image_uris: any
  legal_standard: boolean
  legal_historic: boolean
  legal_brawl: boolean
  in_arena: boolean
  tags: string[]
}

function extractTags(card: ScryfallCard): string[] {
  const tags: string[] = []
  const text = (card.oracle_text || '').toLowerCase()
  const typeLine = (card.type_line || '').toLowerCase()

  // Meccaniche comuni
  if (text.includes('gain') && text.includes('life')) tags.push('lifegain')
  if (text.includes('treasure')) tags.push('treasures')
  if (text.includes('token')) tags.push('tokens')
  if (text.includes('+1/+1 counter') || text.includes('counter') && text.includes('+1')) tags.push('counters')
  if (text.includes('destroy') || text.includes('exile')) tags.push('removal')
  if (text.includes('draw') && text.includes('card')) tags.push('draw')
  if (text.includes('mana') && (text.includes('add') || text.includes('produce'))) tags.push('ramp')
  if (text.includes('sacrifice')) tags.push('sacrifice')
  if (text.includes('graveyard') || text.includes('return') && text.includes('battlefield')) tags.push('graveyard')
  if (text.includes('instant') || text.includes('sorcery')) tags.push('spells-matter')
  if (text.includes('creature') && text.includes('enters')) tags.push('creatures-matter')
  if (text.includes('artifact')) tags.push('artifacts-matter')
  if (text.includes('enchantment')) tags.push('enchantments-matter')
  if (text.includes('surveil')) tags.push('surveil')
  if (text.includes('connive')) tags.push('connive')
  if (text.includes('energy')) tags.push('energy')
  if (text.includes('flash') || text.includes('instant speed')) tags.push('flash')
  if (text.includes('flying')) tags.push('flying')
  if (text.includes('trample')) tags.push('trample')
  if (text.includes('vigilance')) tags.push('vigilance')
  if (text.includes('haste')) tags.push('haste')
  if (text.includes('reach')) tags.push('reach')
  if (text.includes('deathtouch')) tags.push('deathtouch')
  if (text.includes('lifelink')) tags.push('lifelink')
  if (text.includes('first strike') || text.includes('double strike')) tags.push('first-strike')
  if (text.includes('hexproof') || text.includes('shroud')) tags.push('protection')
  if (text.includes('indestructible')) tags.push('indestructible')

  // Archetipi comuni
  if (typeLine.includes('creature') && card.mana_value && card.mana_value <= 2) tags.push('aggro')
  if (typeLine.includes('instant') || typeLine.includes('sorcery')) {
    if (text.includes('counter') && text.includes('spell')) tags.push('control')
    if (text.includes('damage') && text.includes('target')) tags.push('burn')
  }
  if (typeLine.includes('land')) tags.push('lands')
  if (typeLine.includes('artifact') && text.includes('mana')) tags.push('mana-rocks')

  return tags
}

function processCard(card: ScryfallCard): ProcessedCard {
  const types = (card.type_line || '').split(' — ')[0].split(' ').filter(Boolean)
  
  // Determine legalities
  const legal_standard = card.legalities?.standard === 'legal'
  const legal_historic = card.legalities?.historic === 'legal'
  // Historic Brawl legalità: se è legale in Historic o esplicitamente in brawl
  const legal_brawl = card.legalities?.historicbrawl === 'legal' || 
                     card.legalities?.brawl === 'legal' || 
                     legal_historic

  // Extract tags based on card text and type
  const tags = extractTags(card)

  return {
    scryfall_id: card.id,
    arena_id: card.arena_id ?? null,
    name: card.name,
    mana_value: card.mana_value ?? null,
    mana_cost: card.mana_cost ?? null,
    colors: card.colors || [],
    color_identity: card.color_identity || [],
    types,
    oracle_text: card.oracle_text || null,
    set_code: card.set || null,
    collector_number: card.collector_number || null,
    rarity: card.rarity || null,
    image_url: card.image_uris?.normal || null, // Per backward compatibility
    image_uris: card.image_uris || null,
    legal_standard,
    legal_historic,
    legal_brawl,
    in_arena: (card.games || []).includes('arena'),
    tags
  }
}

async function fetchAllScryfallCards(): Promise<ScryfallCard[]> {
  let url = SCRYFALL_BULK_URL
  const allCards: ScryfallCard[] = []
  let pageCount = 0
  const maxPages = 200 // Safety limit

  console.log('Starting Scryfall sync...')
  
  while (url && pageCount < maxPages) {
    try {
      console.log(`Fetching page ${pageCount + 1}...`)
      const response = await fetch(url, { 
        cache: 'no-store',
        headers: {
          'User-Agent': 'MTGAIDeckBuilder/1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from Scryfall')
      }
      
      allCards.push(...data.data as ScryfallCard[])
      console.log(`Page ${pageCount + 1}: ${data.data.length} cards, total: ${allCards.length}`)
      
      // Check if there are more pages
      if (data.has_more && data.next_page) {
        url = data.next_page
        pageCount++
        
        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      } else {
        break
      }
      
    } catch (error) {
      console.error(`Error fetching page ${pageCount + 1}:`, error)
      throw error
    }
  }
  
  console.log(`Scryfall sync completed: ${allCards.length} total cards`)
  return allCards
}

export async function GET(req: NextRequest) {
  // Authentication check
  const key = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key') || ''
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Environment check
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
    console.log('Starting card sync process...')
    
    // Fetch all cards from Scryfall
    const scryfallCards = await fetchAllScryfallCards()
    
    if (scryfallCards.length === 0) {
      throw new Error('No cards returned from Scryfall')
    }
    
    // Process cards for database
    const processedCards = scryfallCards.map(processCard)
    
    // Filter for Arena-only cards to reduce database size
    const arenaCards = processedCards.filter(card => card.in_arena)
    console.log(`Filtered to ${arenaCards.length} Arena cards`)
    
    // Upsert cards in chunks to avoid timeouts
    let totalUpserts = 0
    const chunkSize = 200
    
    for (let i = 0; i < arenaCards.length; i += chunkSize) {
      const chunk = arenaCards.slice(i, i + chunkSize)
      console.log(`Upserting chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(arenaCards.length / chunkSize)}...`)
      
      const { error, count } = await supa
        .from('cards')
        .upsert(chunk, { 
          onConflict: 'scryfall_id',
          count: 'exact'
        })
      
      if (error) {
        console.error('Upsert error:', error)
        throw new Error(`Database upsert failed: ${error.message}`)
      }
      
      totalUpserts += count || chunk.length
    }
    
    // Log success
    const successMessage = `Sync completed successfully: ${totalUpserts} cards upserted`
    console.log(successMessage)
    
    await supa.from('admin_logs').insert({
      action: 'sync',
      message: successMessage
    })
    
    return NextResponse.json({ 
      ok: true, 
      upserts: totalUpserts,
      total_fetched: scryfallCards.length,
      arena_cards: arenaCards.length
    })
    
  } catch (error: any) {
    const errorMessage = `Sync failed: ${String(error)}`
    console.error('Sync error:', error)
    
    // Log error to database
    try {
      await supa.from('admin_logs').insert({
        action: 'sync_error',
        message: errorMessage
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }
    
    return NextResponse.json({ 
      ok: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}