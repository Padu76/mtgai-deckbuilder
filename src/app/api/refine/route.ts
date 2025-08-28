import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { deck, action } = body
  // Simple placeholder refinements
  if (deck.format === 'standard') {
    if (action === 'moreRemoval') {
      deck.main.unshift({ name: 'Abrade', set: 'BRO', number: '128', quantity: 1 })
      deck.main[deck.main.length-1].quantity = Math.max(0, (deck.main[deck.main.length-1].quantity||1)-1)
    }
    if (action === 'lowerCurve') {
      deck.main.unshift({ name: 'Phoenix Chick', set: 'DMU', number: '141', quantity: 1 })
    }
    if (action === 'saferMana') {
      // In mono-R stub, no-op
    }
    if (action === 'budget') {
      // No-op for stub
    }
  }
  return NextResponse.json(deck)
}
