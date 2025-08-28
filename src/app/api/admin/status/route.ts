import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return NextResponse.json({ ok:false, error:'Missing env' }, { status:500 })
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })

  const { data: cards, error: e1 } = await supa.from('cards').select('in_arena')
  if (e1) return NextResponse.json({ ok:false, error:e1.message }, { status:500 })

  const total_cards = cards?.length || 0
  const total_arena = cards?.filter((c:any)=>c.in_arena).length || 0

  const { data: logs, error: e2 } = await supa.from('admin_logs').select('*').order('created_at', { ascending:false }).limit(5)
  if (e2) return NextResponse.json({ ok:false, error:e2.message }, { status:500 })

  return NextResponse.json({ ok:true, total_cards, total_arena, last_sync_at: logs?.[0]?.created_at || null, logs: logs||[] })
}
