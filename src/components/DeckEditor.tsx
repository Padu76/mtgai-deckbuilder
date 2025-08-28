'use client'
import { useState, useMemo } from 'react'

type CardEntry = { name: string; set?: string; number?: string; quantity?: number; role?: 'main'|'side'|'commander' }
type DeckData = { format: 'standard'|'brawl'; bo?: 'bo1'|'bo3'; commander?: string; main: CardEntry[]; side?: CardEntry[] }

export function DeckEditor({ initialDeck }: { initialDeck: DeckData }) {
  const [deck, setDeck] = useState<DeckData>(initialDeck)

  const exportText = useMemo(() => {
    const lines: string[] = []
    lines.push('Deck')
    deck.main.forEach(c => lines.push(`${c.quantity ?? 1} ${c.name}${c.set ? ` (${c.set})` : ''}${c.number ? ` ${c.number}` : ''}`))
    if (deck.format !== 'brawl' && deck.side && deck.side.length) {
      lines.push('', 'Sideboard')
      deck.side.forEach(c => lines.push(`${c.quantity ?? 1} ${c.name}${c.set ? ` (${c.set})` : ''}${c.number ? ` ${c.number}` : ''}`))
    }
    return lines.join('\n')
  }, [deck])

  async function refine(type: 'moreRemoval'|'lowerCurve'|'saferMana'|'budget') {
    const res = await fetch('/api/refine', { method: 'POST', body: JSON.stringify({ deck, action: type }) })
    const data = await res.json()
    setDeck(data)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button className="bg-slate-800 px-3 py-2 rounded hover:bg-slate-700" onClick={()=>refine('moreRemoval')}>+ Removal</button>
        <button className="bg-slate-800 px-3 py-2 rounded hover:bg-slate-700" onClick={()=>refine('lowerCurve')}>Curva più bassa</button>
        <button className="bg-slate-800 px-3 py-2 rounded hover:bg-slate-700" onClick={()=>refine('saferMana')}>Mana più sicuro</button>
        <button className="bg-slate-800 px-3 py-2 rounded hover:bg-slate-700" onClick={()=>refine('budget')}>Versione budget</button>
        <a download="deck.mtga.txt" href={"data:text/plain;charset=utf-8,"+encodeURIComponent(exportText)}
           className="ml-auto bg-orange-600 px-3 py-2 rounded hover:bg-orange-500">Esporta MTGA</a>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <section>
          <h3 className="font-semibold mb-2">Main</h3>
          <ul className="space-y-1">
            {deck.main.map((c,i)=>(
              <li key={i} className="text-sm opacity-90">{c.quantity ?? 1}× {c.name}{c.set ? ` (${c.set})` : ''}{c.number ? ` ${c.number}` : ''}</li>
            ))}
          </ul>
        </section>
        {deck.format!=='brawl' && (
          <section>
            <h3 className="font-semibold mb-2">Sideboard</h3>
            <ul className="space-y-1">
              {(deck.side ?? []).map((c,i)=>(
                <li key={i} className="text-sm opacity-90">{c.quantity ?? 1}× {c.name}{c.set ? ` (${c.set})` : ''}{c.number ? ` ${c.number}` : ''}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div>
        <h3 className="font-semibold mb-2">Export MTG Arena</h3>
        <textarea readOnly value={exportText} rows={10} className="w-full bg-slate-800 rounded p-2 font-mono text-sm" />
        <p className="text-xs opacity-70">Copia tutto → in Arena vai su <b>Decks → Import</b>.</p>
      </div>
    </div>
  )
}
