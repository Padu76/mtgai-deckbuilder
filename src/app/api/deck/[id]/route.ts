// src/app/api/deck/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

interface TempDeck {
  id: string
  selected_combos: any[]
  deck_cards: any[]
  metadata: {
    format: string
    colors: string[]
    archetype: string
    created_at: string
    last_updated: string
  }
  status: 'building' | 'completed' | 'exported'
}

// GET - Recupera deck temporaneo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deckId = params.id
    
    if (!deckId) {
      return NextResponse.json({
        ok: false,
        error: 'Deck ID required'
      }, { status: 400 })
    }

    console.log(`Fetching temp deck: ${deckId}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data, error } = await supabase
      .from('temp_decks')
      .select('*')
      .eq('id', deckId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return NextResponse.json({
          ok: false,
          error: 'Deck not found',
          suggestion: 'The deck may have expired or been deleted'
        }, { status: 404 })
      }
      
      console.error('Database error:', error)
      return NextResponse.json({
        ok: false,
        error: 'Failed to fetch deck: ' + error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deck: data,
      retrieved_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('GET deck error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to retrieve deck: ' + error.message
    }, { status: 500 })
  }
}

// POST - Crea nuovo deck temporaneo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deckId = params.id
    const body = await request.json()
    
    const {
      selected_combos = [],
      deck_cards = [],
      metadata = {}
    } = body

    console.log(`Creating temp deck: ${deckId} with ${selected_combos.length} combos`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const tempDeck: TempDeck = {
      id: deckId,
      selected_combos,
      deck_cards,
      metadata: {
        format: metadata.format || 'standard',
        colors: metadata.colors || [],
        archetype: metadata.archetype || 'unknown',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      },
      status: 'building'
    }

    const { error } = await supabase
      .from('temp_decks')
      .insert(tempDeck)

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({
        ok: false,
        error: 'Failed to create deck: ' + error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deck: tempDeck,
      message: 'Deck created successfully'
    })

  } catch (error: any) {
    console.error('POST deck error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to create deck: ' + error.message
    }, { status: 500 })
  }
}

// PUT - Aggiorna deck temporaneo (per AI Completa Deck)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deckId = params.id
    const body = await request.json()
    
    const {
      selected_combos,
      deck_cards,
      metadata,
      status = 'building'
    } = body

    console.log(`Updating temp deck: ${deckId}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Prima controlla se il deck esiste
    const { data: existingDeck, error: fetchError } = await supabase
      .from('temp_decks')
      .select('*')
      .eq('id', deckId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Fetch error:', fetchError)
      return NextResponse.json({
        ok: false,
        error: 'Database error: ' + fetchError.message
      }, { status: 500 })
    }

    const updateData: any = {
      last_updated: new Date().toISOString(),
      status
    }

    // Aggiorna solo i campi forniti
    if (selected_combos !== undefined) {
      updateData.selected_combos = selected_combos
    }
    if (deck_cards !== undefined) {
      updateData.deck_cards = deck_cards
    }
    if (metadata !== undefined) {
      updateData.metadata = {
        ...existingDeck?.metadata || {},
        ...metadata,
        last_updated: new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('temp_decks')
      .update(updateData)
      .eq('id', deckId)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({
        ok: false,
        error: 'Failed to update deck: ' + error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deck: data,
      message: 'Deck updated successfully'
    })

  } catch (error: any) {
    console.error('PUT deck error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to update deck: ' + error.message
    }, { status: 500 })
  }
}

// DELETE - Elimina deck temporaneo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deckId = params.id
    
    console.log(`Deleting temp deck: ${deckId}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { error } = await supabase
      .from('temp_decks')
      .delete()
      .eq('id', deckId)

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({
        ok: false,
        error: 'Failed to delete deck: ' + error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Deck deleted successfully'
    })

  } catch (error: any) {
    console.error('DELETE deck error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to delete deck: ' + error.message
    }, { status: 500 })
  }
}