// src/app/api/admin/sync-scryfall/route.ts
// Endpoint per sincronizzazione massiva carte con Scryfall (immagini + nomi italiani)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  fetchCardWithLocalizations, 
  batchLocalizeCards, 
  validateCardData,
  needsScryfallSync 
} from '../../../../lib/scryfall-enhanced'

const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
  },
  admin: {
    key: process.env.NEXT_PUBLIC_ADMIN_KEY!
  }
}

interface SyncResult {
  success: boolean
  message: string
  stats?: {
    cards_processed: number
    cards_updated: number
    cards_with_italian_names: number
    cards_with_images: number
    errors: number
  }
  errors?: string[]
  log?: string[]
}

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  const log: string[] = []
  const errors: string[] = []
  
  try {
    log.push('Starting Scryfall cards synchronization...')
    
    const body = await request.json()
    const adminKey = body.adminKey || request.headers.get('x-admin-key')
    const mode = body.mode || 'outdated' // 'all', 'outdated', 'missing_images', 'missing_italian'
    const limit = Math.min(body.limit || 100, 500) // Max 500 per volta per evitare timeout
    
    if (adminKey !== config.admin.key) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 })
    }

    const supabase = createClient(config.supabase.url, config.supabase.serviceKey)
    log.push('Supabase client initialized')

    // Step 1: Ottieni carte da processare
    log.push(`Loading cards to sync (mode: ${mode}, limit: ${limit})...`)
    const cardsToProcess = await getCardsToSync(supabase, mode, limit, log)
    log.push(`Found ${cardsToProcess.length} cards to process`)

    if (cardsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards need synchronization',
        stats: {
          cards_processed: 0,
          cards_updated: 0,
          cards_with_italian_names: 0,
          cards_with_images: 0,
          errors: 0
        },
        log
      })
    }

    // Step 2: Batch sync con Scryfall
    log.push('Starting batch localization from Scryfall...')
    const scryfallIds = cardsToProcess.map(card => card.scryfall_id)
    
    let processedCount = 0
    const localizedCards = await batchLocalizeCards(
      scryfallIds,
      (processed, total) => {
        processedCount = processed
        if (processed % 10 === 0) {
          log.push(`Processed ${processed}/${total} cards...`)
        }
      }
    )

    log.push(`Successfully localized ${localizedCards.length} cards`)

    // Step 3: Aggiorna database
    log.push('Updating database with localized data...')
    const updateStats = await updateCardsInDatabase(supabase, localizedCards, log, errors)

    const finalStats = {
      cards_processed: cardsToProcess.length,
      cards_updated: updateStats.updated,
      cards_with_italian_names: updateStats.with_italian,
      cards_with_images: updateStats.with_images,
      errors: errors.length
    }

    log.push('Scryfall synchronization completed!')
    log.push(`Updated ${updateStats.updated} cards`)
    log.push(`${updateStats.with_italian} cards now have Italian names`)
    log.push(`${updateStats.with_images} cards now have images`)

    return NextResponse.json({
      success: true,
      message: `Synchronized ${updateStats.updated} cards with Scryfall data`,
      stats: finalStats,
      errors: errors.length > 0 ? errors : undefined,
      log
    })

  } catch (error) {
    const errorMessage = (error as Error).message
    errors.push(`Fatal error: ${errorMessage}`)
    log.push(`Scryfall sync failed: ${errorMessage}`)

    return NextResponse.json({
      success: false,
      message: 'Scryfall synchronization failed',
      errors,
      log
    }, { status: 500 })
  }
}

async function getCardsToSync(
  supabase: any, 
  mode: string, 
  limit: number, 
  log: string[]
): Promise<Array<{id: string, scryfall_id: string, name: string, scryfall_synced_at?: string}>> {
  let query = supabase
    .from('cards')
    .select('id, scryfall_id, name, scryfall_synced_at, image_url, name_it')
    .not('scryfall_id', 'is', null)
    .limit(limit)

  switch (mode) {
    case 'all':
      // Tutte le carte con scryfall_id
      log.push('Mode: sync all cards')
      break
      
    case 'outdated':
      // Carte non sincronizzate negli ultimi 7 giorni
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      query = query.or(`scryfall_synced_at.is.null,scryfall_synced_at.lt.${weekAgo.toISOString()}`)
      log.push('Mode: sync outdated cards (>7 days old)')
      break
      
    case 'missing_images':
      // Carte senza immagini
      query = query.or('image_url.is.null,image_url.eq.')
      log.push('Mode: sync cards missing images')
      break
      
    case 'missing_italian':
      // Carte senza nomi italiani
      query = query.or('name_it.is.null,name_it.eq.')
      log.push('Mode: sync cards missing Italian names')
      break
      
    default:
      // Default: outdated
      const defaultWeekAgo = new Date()
      defaultWeekAgo.setDate(defaultWeekAgo.getDate() - 7)
      query = query.or(`scryfall_synced_at.is.null,scryfall_synced_at.lt.${defaultWeekAgo.toISOString()}`)
      log.push('Mode: default (outdated cards)')
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to load cards: ${error.message}`)
  }

  return data || []
}

async function updateCardsInDatabase(
  supabase: any,
  localizedCards: any[],
  log: string[],
  errors: string[]
): Promise<{updated: number, with_italian: number, with_images: number}> {
  let updated = 0
  let with_italian = 0
  let with_images = 0

  for (const cardData of localizedCards) {
    try {
      if (!validateCardData(cardData.merged)) {
        errors.push(`Invalid card data for ${cardData.merged.name}`)
        continue
      }

      const updateData = {
        name_it: cardData.merged.name_it,
        image_url: cardData.merged.image_url,
        image_uris: cardData.merged.image_uris,
        artwork_uri: cardData.merged.artwork_uri,
        set_name: cardData.merged.set_name,
        flavor_text: cardData.merged.flavor_text,
        flavor_text_it: cardData.merged.flavor_text_it,
        keywords: cardData.merged.keywords,
        produced_mana: cardData.merged.produced_mana,
        rarity: cardData.merged.rarity,
        scryfall_uri: cardData.merged.scryfall_uri,
        scryfall_synced_at: cardData.merged.scryfall_synced_at
      }

      const { error: updateError } = await supabase
        .from('cards')
        .update(updateData)
        .eq('scryfall_id', cardData.merged.scryfall_id)

      if (updateError) {
        errors.push(`Failed to update ${cardData.merged.name}: ${updateError.message}`)
        continue
      }

      updated++
      
      if (cardData.merged.name_it && cardData.merged.name_it !== cardData.merged.name) {
        with_italian++
      }
      
      if (cardData.merged.image_url) {
        with_images++
      }

      // Log progress ogni 25 carte
      if (updated % 25 === 0) {
        log.push(`Database update progress: ${updated} cards processed`)
      }

    } catch (error) {
      errors.push(`Error updating card: ${(error as Error).message}`)
    }
  }

  return { updated, with_italian, with_images }
}

// GET endpoint per statistiche sync
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceKey)
    
    const { data: stats } = await supabase.rpc('get_localization_stats')
    
    if (!stats || stats.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to get localization statistics'
      })
    }

    const result = stats[0]
    
    return NextResponse.json({
      success: true,
      stats: {
        total_cards: parseInt(result.total_cards),
        cards_with_italian_names: parseInt(result.cards_with_italian_names),
        cards_with_images: parseInt(result.cards_with_images),
        cards_synced_last_week: parseInt(result.cards_synced_last_week),
        italian_coverage_percentage: parseFloat(result.coverage_percentage)
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch statistics',
      error: (error as Error).message
    }, { status: 500 })
  }
}