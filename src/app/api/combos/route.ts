// src/app/api/combos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase env' }, { status: 500 })
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { searchParams } = new URL(req.url)

  try {
    let query = supa
      .from('combos')
      .select(`
        id,
        name,
        source,
        result_tag,
        color_identity,
        steps,
        links,
        combo_cards (
          cards (
            id,
            name,
            image_url,
            image_uris,
            mana_cost,
            types
          )
        )
      `)

    // Color filter
    const colors = searchParams.get('colors')
    if (colors && colors.trim()) {
      const colorArray = colors.split(',').filter(Boolean)
      query = query.overlaps('color_identity', colorArray)
    }

    // Format filter (check if combo cards are legal in format)
    const format = searchParams.get('format')
    if (format && format !== 'all') {
      // For format filtering, we need to join with cards and check legality
      // This is a complex query, so we'll filter client-side for now
      // In production, you'd want to optimize this with proper SQL joins
    }

    // Result type filter
    const resultType = searchParams.get('result_type')
    if (resultType && resultType !== 'all') {
      query = query.ilike('result_tag', `%${resultType}%`)
    }

    // Search filter
    const search = searchParams.get('search')
    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`)
    }

    // Limit and order
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    query = query.order('name', { ascending: true }).limit(limit)

    const { data: combos, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Process the results to flatten the card data
    const processedCombos = (combos || []).map(combo => ({
      id: combo.id,
      name: combo.name,
      source: combo.source,
      result_tag: combo.result_tag,
      color_identity: combo.color_identity || [],
      steps: combo.steps,
      links: combo.links || [],
      cards: (combo.combo_cards || []).map((cc: any) => cc.cards).filter(Boolean)
    }))

    // Client-side format filtering if needed
    let filteredCombos = processedCombos
    if (format && format !== 'all') {
      filteredCombos = processedCombos.filter(combo => {
        // Check if all cards in combo are legal in the specified format
        return combo.cards.every((card: any) => {
          // This would need proper card legality data
          // For now, assume all combos work in Historic
          return format === 'historic' || format === 'brawl'
        })
      })
    }

    return NextResponse.json({
      ok: true,
      combos: filteredCombos,
      count: filteredCombos.length
    })

  } catch (e: any) {
    console.error('Combos API error:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// POST endpoint to create new combos (admin only)
export async function POST(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (!adminKey || adminKey !== process.env.NEXT_PUBLIC_ADMIN_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase env' }, { status: 500 })
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })

  try {
    const { name, source, result_tag, color_identity, steps, cards, links } = await req.json()

    // Validate required fields
    if (!name || !result_tag || !cards || !Array.isArray(cards)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing required fields: name, result_tag, cards' 
      }, { status: 400 })
    }

    // Create combo
    const { data: combo, error: comboError } = await supa
      .from('combos')
      .insert({
        name,
        source: source || 'Manual',
        result_tag,
        color_identity: color_identity || [],
        steps: steps || '',
        links: links || []
      })
      .select()
      .single()

    if (comboError) {
      throw comboError
    }

    // Link cards to combo
    if (cards.length > 0) {
      const comboCards = cards.map((cardId: string) => ({
        combo_id: combo.id,
        card_id: cardId
      }))

      const { error: linkError } = await supa
        .from('combo_cards')
        .insert(comboCards)

      if (linkError) {
        // Cleanup: delete the combo if card linking fails
        await supa.from('combos').delete().eq('id', combo.id)
        throw linkError
      }
    }

    return NextResponse.json({
      ok: true,
      combo: combo
    })

  } catch (e: any) {
    console.error('Create combo error:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}