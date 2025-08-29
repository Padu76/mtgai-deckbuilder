import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Card = {
  name: string
  types: string[] | null
  mana_value: number | null
  oracle_text: string | null
  color_identity: string[] | null
  colors: string[] | null
  legal_standard: boolean | null
  in_arena: boolean | null
}

function isLand(c: Card) {
  return (c.types || []).includes('Land')
}

function matchesColors(c: Card, selected: string[]) {
  const id = (c.color_identity || [])
  return id.every(x => selected.includes(x))
}

function scoreCard(c: Card, archetype: string, seedWords: string[]) {
  let s = 0
  const mv = c.mana_value ?? 0
  const text = (c.oracle_text || '').toLowerCase()

  if (archetype === 'aggro') {
    if (mv <= 2) s += 5
    if (mv === 3) s += 2
    if (mv >= 5) s -= 2
  } else if (archetype === 'control') {
    if (mv >= 4) s += 3
    if (text.includes('draw')) s += 2
    if (/counter target/.test(text)) s += 3
  } else {
    if (mv === 2 || mv === 3 || mv === 4) s += 3
  }

  if (/(destroy target|exile target|counter target|deals? \d+ damage)/.test(text)) s += 3
  for (const w of seedWords) if (w && text.includes(w)) s += 2

  return s
}

function pickLands(colorCounts: Record<string, number>, currentNonLands: number) {
  const landsNeeded = Math.max(22, Math.min(26, 60 - currentNonLands))
  const colors = Object.keys(colorCounts).filter(k => colorCounts[k] > 0)
  const sum = colors.reduce((a,k)=>a+colorCounts[k],0) || 1
  const basics: Record<string,string> = { W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest' }
  const result: { name: string, quantity: number }[] = []
  for (const k of colors) {
    const n = Math.round(landsNeeded * (colorCounts[k] / sum))
    if (n>0) result.push({ name: basics[k], quantity: n })
  }
  const diff = landsNeeded - result.reduce((a,x)=>a+x.quantity,0)
  if (result.length && diff !== 0) result[0].quantity += diff
  if (!result.length) result.push({ name: 'Forest', quantity: landsNeeded })
  return result
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Missing Supabase env' }, { status: 500 })
  }
  const body = await req.json().catch(()=>({}))
  const archetype = body.archetype || 'midrange'
  const colors: string[] = body.colors || ['R','G']
  const seeds: string[] = body.seeds || []

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await supa
    .from('cards')
    .select('name, types, mana_value, oracle_text, color_identity, colors, legal_standard, in_arena')
    .eq('in_arena', true)
    .eq('legal_standard', true)
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const pool: Card[] = (data || []).filter(c => matchesColors(c, colors))

  const seedWords = seeds.map((s:string)=> (s.toLowerCase().split(' ').pop() as string)).filter(Boolean)

  const scored = pool
    .filter(c => !isLand(c))
    .map(c => ({ c, s: scoreCard(c, archetype, seedWords) }))
    .sort((a,b)=>b.s - a.s)

  const curve: Record<string, number> = archetype==='aggro'
    ? { '1':8, '2':12, '3':10, '4':4, '5':2 }
    : archetype==='control'
      ? { '2':6, '3':8, '4':10, '5':6, '6':4 }
      : { '1':4, '2':10, '3':12, '4':8, '5':4 }

  const main: { name: string, quantity: number }[] = []
  const colorCounts: Record<string, number> = { W:0,U:0,B:0,R:0,G:0 }

  function addCard(name:string, q:number=1){
    const existing = main.find(x=>x.name===name)
    if (existing) existing.quantity += q
    else main.push({ name, quantity: q })
  }

  for (const s of seeds) {
    const hit = scored.find(x => x.c.name.toLowerCase() === s.toLowerCase())
    if (hit) addCard(hit.c.name, 2)
  }

  const byMV: Record<string, number> = {}
  for (const { c } of scored) {
    const mv = String(Math.round(c.mana_value || 0))
    const target = curve[mv]
    if (!target) continue
    if ((byMV[mv] || 0) >= target) continue
    if (main.reduce((a,x)=>a+x.quantity,0) >= 36) break
    addCard(c.name, 1)
    byMV[mv] = (byMV[mv]||0)+1
    for (const id of (c.color_identity||[])) colorCounts[id] = (colorCounts[id]||0)+1
  }

  const nonLandsTotal = main.reduce((a,x)=>a+x.quantity,0)
  const lands = pickLands(colorCounts, nonLandsTotal)

  const arenaText = [
    ...main.map(c => `${c.quantity} ${c.name}`),
    '',
    ...lands.map(c => `${c.quantity} ${c.name}`)
  ].join('\n')

  const deck = { main: [...main, ...lands], text: arenaText }
  return NextResponse.json(deck)
}
