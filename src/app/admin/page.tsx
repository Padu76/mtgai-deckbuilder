'use client'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [status, setStatus] = useState<string>('')
  const [allowed, setAllowed] = useState<boolean>(false)
  const [keyInput, setKeyInput] = useState<string>('')
  const [keyParam, setKeyParam] = useState<string>('')
  const [info, setInfo] = useState<any|null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const k = url.searchParams.get('key') || ''
    if (k) { setKeyParam(k); verify(k) }
  }, [])

  function verify(k: string) {
    const ADMIN = process.env.NEXT_PUBLIC_ADMIN_KEY || ''
    if (!ADMIN) { setStatus('⚠️ NEXT_PUBLIC_ADMIN_KEY non impostata'); return }
    if (k === ADMIN) { setAllowed(true); setStatus('✅ Accesso admin abilitato.'); loadStatus() }
    else { setAllowed(false); setStatus('❌ Chiave errata.') }
  }

  async function loadStatus() {
    const res = await fetch('/api/admin/status')
    const data = await res.json()
    if (data.ok) setInfo(data)
  }

  async function runSync() {
    setStatus('⏳ Avvio sync…')
    try {
      const k = keyParam || keyInput
      const res = await fetch('/api/admin/sync-scryfall', { headers: { 'x-admin-key': k } })
      const json = await res.json()
      if (!res.ok || json.ok === false) setStatus('❌ Errore sync: ' + (json.error || res.status))
      else { setStatus(`✅ Sync OK: upserts=${json.upserts}`); loadStatus() }
    } catch (e:any) { setStatus('❌ Errore: ' + e.message) }
  }

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Admin</h2>
      {!allowed && (
        <div className="space-y-2 bg-slate-800 p-3 rounded">
          <p>Inserisci chiave admin:</p>
          <div className="flex gap-2">
            <input value={keyInput} onChange={e=>setKeyInput(e.target.value)} className="bg-slate-900 rounded p-2" />
            <button onClick={()=>verify(keyInput)} className="bg-orange-600 px-3 py-2 rounded">Entra</button>
          </div>
          <p className="text-sm opacity-80">{status}</p>
        </div>
      )}
      {allowed && (
        <section className="space-y-3 bg-slate-800 p-3 rounded">
          <button onClick={runSync} className="bg-orange-600 px-4 py-2 rounded hover:bg-orange-500">🔄 Sync Scryfall → Supabase</button>
          <p className="text-sm opacity-80">{status}</p>
          {info && (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="bg-slate-900 p-3 rounded">
                <div className="text-3xl font-bold">{info.total_cards}</div>
                <div className="text-xs opacity-70">Carte totali</div>
              </div>
              <div className="bg-slate-900 p-3 rounded">
                <div className="text-3xl font-bold">{info.total_arena}</div>
                <div className="text-xs opacity-70">Carte su Arena</div>
              </div>
              <div className="bg-slate-900 p-3 rounded">
                <div className="text-sm font-semibold">Ultimo sync</div>
                <div className="text-xs opacity-80">{info.last_sync_at || 'N/D'}</div>
              </div>
              <div className="md:col-span-3 bg-slate-900 p-3 rounded">
                <div className="text-sm font-semibold mb-2">Log recenti</div>
                <ul className="text-xs space-y-1">
                  {info.logs?.map((l:any)=>(<li key={l.id}>{l.created_at}: {l.message}</li>))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
