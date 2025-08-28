
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SCRYFALL_BULK_URL = process.env.SCRYFALL_BULK_URL || 'https://api.scryfall.com/cards/search?q=game%3Aarena+unique%3Aprints'
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || ''

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ScryCard = {
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
  image_uris?: { normal?: string }
  legalities?: Record<string,string>
  games?: string[]
}

function toRow(c: ScryCard) {
  const types = (c.type_line || '').split(' — ')[0].split(' ').filter(Boolean)
  const legal_standard = c.legalities?.standard === 'legal'
  const legal_historic = c.legalities?.historic === 'legal'
  const legal_brawl = (c.legalities as any)?.['brawl'] === 'legal' || (c.legalities?.historic === 'legal')

  return {
    scryfall_id: c.id,
    arena_id: c.arena_id ?? null,
    name: c.name,
    mana_value: c.mana_value ?? null,
    mana_cost: c.mana_cost ?? null,
    colors: c.colors || [],
    color_identity: c.color_identity || [],
    types,
    oracle_text: c.oracle_text || null,
    set_code: c.set,
    collector_number: c.collector_number,
    image_url: c.image_uris?.normal || null,
    legal_standard,
    legal_historic,
    legal_brawl,
    in_arena: (c.games || []).includes('arena'),
    tags: []
  }
}

async function fetchAllCards() {
  let url = SCRYFALL_BULK_URL
  const all: ScryCard[] = []
  for (let i=0;i<100;i++) {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Scryfall error ${res.status}`)
    const data = await res.json()
    all.push(...(data.data as ScryCard[]))
    if (data.has_more && data.next_page) {
      url = data.next_page
    } else break
  }
  return all
}

export async function GET(req: NextRequest) {
  // --- Admin guard ---
  const key = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key') || ''
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase env (URL or SERVICE_ROLE_KEY)' }, { status: 500 })
  }
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  try {
    const scry = await fetchAllCards()
    let upserts = 0
    const chunkSize = 200
    for (let i=0;i<scry.length;i+=chunkSize) {
      const slice = scry.slice(i, i+chunkSize).map(toRow)
      const { error } = await supa.from('cards').upsert(slice, { onConflict: 'scryfall_id' })
      if (error) throw error
      upserts += slice.length
    }
    return NextResponse.json({ ok: true, upserts })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
