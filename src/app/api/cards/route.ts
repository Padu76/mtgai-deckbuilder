// src/app/api/cards/route.ts
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
    let query = supa.from('cards').select(`
      id,
      scryfall_id,
      arena_id,
      name,
      mana_value,
      mana_cost,
      colors,
      color_identity,
      types,
      oracle_text,
      set_code,
      collector_number,
      image_url,
      image_uris,
      rarity,
      legal_standard,
      legal_historic,
      legal_brawl,
      in_arena,
      tags
    `)

    // Format filter
    const format = searchParams.get('format')
    if (format === 'standard') {
      query = query.eq('legal_standard', true)
    } else if (format === 'historic') {
      query = query.eq('legal_historic', true)
    } else if (format === 'brawl') {
      query = query.eq('legal_brawl', true)
    }

    // Arena only filter (sempre attivo)
    query = query.eq('in_arena', true)

    // Search text
    const search = searchParams.get('search')
    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`)
    }

    // Colors filter
    const colors = searchParams.get('colors')
    if (colors && colors.trim()) {
      const colorArray = colors.split(',').filter(Boolean)
      query = query.overlaps('colors', colorArray)
    }

    // Types filter
    const types = searchParams.get('types')
    if (types && types.trim()) {
      const typeArray = types.split(',').filter(Boolean)
      query = query.overlaps('types', typeArray)
    }

    // Rarity filter
    const rarity = searchParams.get('rarity')
    if (rarity && rarity.trim()) {
      const rarityArray = rarity.split(',').filter(Boolean)
      query = query.in('rarity', rarityArray)
    }

    // CMC range
    const cmcMin = searchParams.get('cmc_min')
    const cmcMax = searchParams.get('cmc_max')
    if (cmcMin && !isNaN(Number(cmcMin))) {
      query = query.gte('mana_value', Number(cmcMin))
    }
    if (cmcMax && !isNaN(Number(cmcMax))) {
      query = query.lte('mana_value', Number(cmcMax))
    }

    // Tags filter
    const tags = searchParams.get('tags')
    if (tags && tags.trim()) {
      const tagArray = tags.split(',').filter(Boolean)
      query = query.overlaps('tags', tagArray)
    }

    // Sort
    const sort = searchParams.get('sort') || 'name'
    switch (sort) {
      case 'cmc':
        query = query.order('mana_value', { ascending: true }).order('name', { ascending: true })
        break
      case 'rarity':
        // Ordine rarità: common, uncommon, rare, mythic
        query = query.order('rarity', { ascending: false }).order('name', { ascending: true })
        break
      case 'name':
      default:
        query = query.order('name', { ascending: true })
        break
    }

    // Limit e offset per paginazione
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 1000)
    const offset = Number(searchParams.get('offset')) || 0
    
    if (offset > 0) {
      query = query.range(offset, offset + limit - 1)
    } else {
      query = query.limit(limit)
    }

    const { data: cards, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Processa le carte per assicurare format consistente
    const processedCards = (cards || []).map(card => ({
      ...card,
      colors: card.colors || [],
      color_identity: card.color_identity || [],
      types: card.types || [],
      tags: card.tags || [],
      // Gestione immagini: priorita image_uris se presente, altrimenti image_url
      image_uris: card.image_uris ? card.image_uris : (card.image_url ? { normal: card.image_url } : null)
    }))

    return NextResponse.json({
      ok: true,
      cards: processedCards,
      count: processedCards.length,
      total_available: processedCards.length // In una implementazione reale, faresti una query COUNT separata
    })

  } catch (e: any) {
    console.error('Cards API error:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}