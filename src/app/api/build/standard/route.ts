import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { colors = ['R'], archetype = 'aggro', queue = 'bo1' } = body

  // Simple stub: produce a legal-ish mono red aggro list
  const main = [
    { name: 'Monastery Swiftspear', set: 'LTR', number: '144', quantity: 4 },
    { name: 'Phoenix Chick', set: 'DMU', number: '141', quantity: 4 },
    { name: 'Play with Fire', set: 'MID', number: '154', quantity: 4 },
    { name: 'Lightning Strike', set: 'DMU', number: '137', quantity: 4 },
    { name: 'Kumano Faces Kakkazan', set: 'NEO', number: '152', quantity: 4 },
    { name: 'Voldaren Epicure', set: 'VOW', number: '182', quantity: 4 },
    { name: 'Squee, Dubious Monarch', set: 'DMU', number: '151', quantity: 2 },
    { name: 'Nahiri\'s Warcrafting', set: 'MOM', number: '156', quantity: 2 },
    { name: 'Invasion of Tarkir', set: 'MOM', number: '149', quantity: 4 },
    { name: 'Mountain', set: 'MOM', number: '282', quantity: 28 },
  ]
  const side = queue==='bo3' ? [
    { name: 'Lithomantic Barrage', set: 'MOM', number: '148', quantity: 3 },
    { name: 'Abrade', set: 'BRO', number: '128', quantity: 3 },
    { name: 'Rending Flame', set: 'VOW', number: '177', quantity: 3 },
    { name: 'Unlicensed Hearse', set: 'SNC', number: '246', quantity: 3 },
    { name: 'Brotherhood’s End', set: 'BRO', number: '128', quantity: 3 },
  ] : []

  return NextResponse.json({ format: 'standard', bo: queue, main, side })
}
