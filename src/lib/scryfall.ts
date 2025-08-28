export type Card = {
  id: string
  name: string
  mana_value?: number
  mana_cost?: string
  colors?: string[]
  color_identity?: string[]
  type_line?: string
  oracle_text?: string
  set?: string
  collector_number?: string
  image_uris?: { normal?: string }
  legalities?: Record<string, string>
  games?: string[]
}

export async function fetchArenaStandardCards(): Promise<Card[]> {
  // Minimal fetch (client-side dev only); in prod, use server cron to persist into DB
  const url = process.env.SCRYFALL_SEARCH_URL || 'https://api.scryfall.com/cards/search?q=game%3Aarena+legal%3Astandard'
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  return data.data || []
}
