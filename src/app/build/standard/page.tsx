'use client'
import { useState } from 'react'

type DeckCard = { name: string; quantity: number }
type BuildResponse = { main: DeckCard[]; side?: DeckCard[]; text: string }

const COLORS = [
  { key: 'W', label: 'White' },
  { key: 'U', label: 'Blue' },
  { key: 'B', label: 'Black' },
  { key: 'R', label: 'Red' },
  { key: 'G', label: 'Green' },
]

export default function StandardBuilderPage() {
  const [archetype, setArchetype] = useState<'aggro'|'midrange'|'control'>('midrange')
  const [colors, setColors] = useState<string[]>(['R','G'])
  const [seeds, setSeeds] = useState<string>('') // comma-separated names
  const [loading, setLoading] = useState(false)
  const [deck, setDeck] = useState<BuildResponse|null>(null)
  const [error, setError] = useState<string>('')

  function toggleColor(k:string){
    setColors(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev,k])
  }

  async function build() {
    setLoading(true); setError(''); setDeck(null)
    try {
      const res = await fetch('/api/build/standard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          archetype,
          colors,
          seeds: seeds.split(',').map(s=>s.trim()).filter(Boolean)
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setDeck(json as BuildResponse)
    } catch (e:any) {
      setError(e.message || 'Errore generazione')
    } finally {
      setLoading(false)
    }
  }

  function copyText() {
    if (deck?.text) navigator.clipboard.writeText(deck.text)
  }

  return (
    <main className="space-y-4">
      <h2 className="text-lg font-semibold">Builder Standard</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-800 p-3 rounded space-y-3">
          <div>
            <label className="block text-sm mb-1">Archetipo</label>
            <select value={archetype} onChange={e=>setArchetype(e.target.value as any)} className="bg-slate-900 p-2 rounded w-full">
              <option value="aggro">Aggro</option>
              <option value="midrange">Midrange</option>
              <option value="control">Control</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Colori</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c.key} onClick={()=>toggleColor(c.key)}
                  className={`px-3 py-1 rounded ${colors.includes(c.key) ? 'bg-orange-600' : 'bg-slate-900'}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs opacity-70 mt-1">Consiglio: max 2 colori per MVP.</p>
          </div>

          <div>
            <label className="block text-sm mb-1">Seed cards (nomi, separati da virgola)</label>
            <textarea value={seeds} onChange={e=>setSeeds(e.target.value)} rows={3}
              className="bg-slate-900 p-2 rounded w-full" placeholder="Es: Lightning Strike, Llanowar Elves"></textarea>
          </div>

          <button onClick={build} disabled={loading || colors.length===0} className="bg-orange-600 px-4 py-2 rounded disabled:opacity-50">
            {loading ? 'Generazione…' : 'Genera Deck'}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="md:col-span-2 bg-slate-800 p-3 rounded space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Risultato</h3>
            {deck?.text && <button onClick={copyText} className="bg-slate-900 px-3 py-1 rounded">Copia per MTG Arena</button>}
          </div>
          {!deck && <p className="opacity-70 text-sm">Nessun deck generato ancora.</p>}
          {deck && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-1">Main (60)</h4>
                <ul className="text-sm space-y-1">
                  {deck.main.map((c,i)=>(<li key={i}>{c.quantity} {c.name}</li>))}
                </ul>
              </div>
              {deck.side && (
                <div>
                  <h4 className="font-semibold mb-1">Side (15)</h4>
                  <ul className="text-sm space-y-1">
                    {deck.side.map((c,i)=>(<li key={i}>{c.quantity} {c.name}</li>))}
                  </ul>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Testo (MTG Arena import)</label>
                <textarea readOnly rows={10} className="bg-slate-900 p-2 rounded w-full" value={deck.text}></textarea>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
