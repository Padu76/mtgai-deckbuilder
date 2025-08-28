import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { commander_name = 'Tatyova, Steward of Tides' } = body
  // Minimal stub brawl list (not guaranteed 100 here; MVP fills with basics)
  const commander = { name: commander_name, role: 'commander' }
  const main = [
    { name: commander_name, quantity: 1, role: 'commander' },
    { name: 'Llanowar Elves', quantity: 1 },
    { name: 'Growth Spiral', quantity: 1 },
    { name: 'Cultivate', quantity: 1 },
    { name: 'Explore', quantity: 1 },
    { name: 'Hydroid Krasis', quantity: 1 },
  ]
  // Fill to 100 with basic lands as placeholder
  const current = main.length
  const basicsToAdd = Math.max(0, 100 - current)
  for (let i=0;i<basicsToAdd;i++) main.push({ name: i % 2 === 0 ? 'Island' : 'Forest', quantity: 1 })
  return NextResponse.json({ format: 'brawl', main, commander: commander_name })
}
