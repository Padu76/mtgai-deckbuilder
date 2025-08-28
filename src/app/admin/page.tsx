
'use client'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [status, setStatus] = useState<string>('')
  const [allowed, setAllowed] = useState<boolean>(false)
  const [keyInput, setKeyInput] = useState<string>('')
  const [keyParam, setKeyParam] = useState<string>('')

  useEffect(() => {
    const url = new URL(window.location.href)
    const k = url.searchParams.get('key') || ''
    if (k) { setKeyParam(k); verify(k) }
  }, [])

  function verify(k: string) {
    const ADMIN = process.env.NEXT_PUBLIC_ADMIN_KEY || ''
    if (!ADMIN) {
      setStatus('⚠️ NEXT_PUBLIC_ADMIN_KEY non impostata nelle env.')
      setAllowed(false)
      return
    }
    if (k === ADMIN) {
      setAllowed(true)
      setStatus('✅ Accesso admin abilitato.')
    } else {
      setAllowed(false)
      setStatus('❌ Chiave errata.')
    }
  }

  async function runSync() {
    setStatus('⏳ Avvio sync…')
    try {
      const k = keyParam || keyInput;
      const res = await fetch('/api/admin/sync-scryfall', { method: 'GET', headers: { 'x-admin-key': k } })
      const json = await res.json()
      if (!res.ok || json.ok === false) {
        setStatus('❌ Errore sync: ' + (json.error || res.status))
      } else {
        setStatus(`✅ Sync OK: upserts=${json.upserts}`)
      }
    } catch (e:any) {
      setStatus('❌ Errore: ' + e.message)
    }
  }

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Admin</h2>
      {!allowed && (
        <div className="space-y-2 bg-slate-800 p-3 rounded">
          <p>Inserisci chiave admin per accedere (imposta <code>NEXT_PUBLIC_ADMIN_KEY</code> nelle env).</p>
          <div className="flex gap-2">
            <input value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="Chiave…"
              className="bg-slate-900 rounded p-2 flex-1" />
            <button onClick={()=>verify(keyInput)} className="bg-orange-600 px-3 py-2 rounded">Entra</button>
          </div>
          <p className="text-sm opacity-80">{status}</p>
        </div>
      )}
      {allowed && (
        <section className="space-y-3 bg-slate-800 p-3 rounded">
          <button onClick={runSync} className="bg-orange-600 px-4 py-2 rounded hover:bg-orange-500">🔄 Sync Scryfall → Supabase</button>
          <p className="text-sm opacity-80">{status}</p>
          <p className="text-xs opacity-60">Tip: salva nei preferiti con <code>?key=LA_TUA_CHIAVE</code>.</p>
        </section>
      )}
    </main>
  )
}
