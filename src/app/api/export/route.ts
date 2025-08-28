import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { deck } = await req.json()
  const lines: string[] = []
  lines.push('Deck')
  deck.main.forEach((c: any) => lines.push(`${c.quantity ?? 1} ${c.name}${c.set ? ` (${c.set})` : ''}${c.number ? ` ${c.number}` : ''}`))
  if (deck.format!=='brawl' && deck.side?.length) {
    lines.push('', 'Sideboard')
    deck.side.forEach((c: any) => lines.push(`${c.quantity ?? 1} ${c.name}${c.set ? ` (${c.set})` : ''}${c.number ? ` ${c.number}` : ''}`))
  }
  return NextResponse.json({ text: lines.join('\n') })
}
