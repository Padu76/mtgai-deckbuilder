// src/lib/scryfall-enhanced.ts
// Enhanced Scryfall integration per immagini e nomi italiani

interface ScryfallCard {
  id: string
  name: string
  lang: string
  mana_cost?: string
  cmc?: number
  colors?: string[]
  color_identity?: string[]
  type_line?: string
  oracle_text?: string
  flavor_text?: string
  keywords?: string[]
  produced_mana?: string[]
  set: string
  set_name: string
  collector_number: string
  rarity: string
  image_uris?: {
    small?: string
    normal?: string
    large?: string
    png?: string
    art_crop?: string
    border_crop?: string
  }
  legalities?: { [format: string]: string }
  games?: string[]
  arena_id?: number
  uri: string
  scryfall_uri: string
  printed_name?: string
}

interface LocalizedCardData {
  english: ScryfallCard
  italian?: ScryfallCard
  merged: {
    id: string
    scryfall_id: string
    name: string
    name_it?: string
    oracle_text: string
    flavor_text?: string
    flavor_text_it?: string
    mana_cost?: string
    cmc?: number
    colors?: string[]
    color_identity?: string[]
    types: string[]
    keywords?: string[]
    produced_mana?: string[]
    set_code: string
    set_name: string
    collector_number: string
    rarity: string
    image_url?: string
    image_uris?: object
    artwork_uri?: string
    legal_standard: boolean
    legal_historic: boolean
    legal_brawl: boolean
    in_arena: boolean
    scryfall_uri: string
    scryfall_synced_at: string
  }
}

const SCRYFALL_API_BASE = 'https://api.scryfall.com'
const RATE_LIMIT_DELAY = 100 // milliseconds between requests

// Sleep function for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Fetch card data in both English and Italian from Scryfall
 */
export async function fetchCardWithLocalizations(
  scryfallId: string
): Promise<LocalizedCardData | null> {
  try {
    // Fetch English version
    const englishResponse = await fetch(`${SCRYFALL_API_BASE}/cards/${scryfallId}?format=json`, {
      headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
    })
    
    if (!englishResponse.ok) {
      throw new Error(`Failed to fetch English card: ${englishResponse.status}`)
    }
    
    const english: ScryfallCard = await englishResponse.json()
    await sleep(RATE_LIMIT_DELAY)
    
    // Try to fetch Italian version
    let italian: ScryfallCard | undefined
    
    try {
      const italianResponse = await fetch(
        `${SCRYFALL_API_BASE}/cards/${scryfallId}/it?format=json`,
        {
          headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
        }
      )
      
      if (italianResponse.ok) {
        italian = await italianResponse.json()
      }
    } catch (error) {
      console.log(`No Italian translation available for ${english.name}`)
    }
    
    // Merge data
    const merged = mergeCardLocalizations(english, italian)
    
    return {
      english,
      italian,
      merged
    }
    
  } catch (error) {
    console.error(`Error fetching card ${scryfallId}:`, error)
    return null
  }
}

/**
 * Search for Arena cards with specific criteria
 */
export async function searchArenaCards(
  query: string,
  page: number = 1,
  includeLocalizations: boolean = false
): Promise<LocalizedCardData[]> {
  const results: LocalizedCardData[] = []
  
  try {
    const searchQuery = `game:arena ${query}`
    const url = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(searchQuery)}&page=${page}`
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        return [] // No results
      }
      throw new Error(`Search failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.data || !Array.isArray(data.data)) {
      return []
    }
    
    for (const card of data.data) {
      if (includeLocalizations) {
        // Fetch full localization data
        const localized = await fetchCardWithLocalizations(card.id)
        if (localized) {
          results.push(localized)
        }
        await sleep(RATE_LIMIT_DELAY)
      } else {
        // Use English only
        const merged = mergeCardLocalizations(card, undefined)
        results.push({
          english: card,
          merged
        })
      }
    }
    
    return results
    
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

/**
 * Fetch cards from a specific set
 */
export async function fetchSetCards(
  setCode: string,
  includeLocalizations: boolean = false
): Promise<LocalizedCardData[]> {
  const results: LocalizedCardData[] = []
  let page = 1
  let hasMore = true
  
  while (hasMore) {
    try {
      const url = `${SCRYFALL_API_BASE}/cards/search?q=game:arena+set:${setCode}&page=${page}`
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          hasMore = false
          break
        }
        throw new Error(`Failed to fetch set ${setCode}: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false
        break
      }
      
      for (const card of data.data) {
        if (includeLocalizations) {
          const localized = await fetchCardWithLocalizations(card.id)
          if (localized) {
            results.push(localized)
          }
          await sleep(RATE_LIMIT_DELAY)
        } else {
          const merged = mergeCardLocalizations(card, undefined)
          results.push({
            english: card,
            merged
          })
        }
      }
      
      hasMore = data.has_more
      page++
      await sleep(RATE_LIMIT_DELAY)
      
    } catch (error) {
      console.error(`Error fetching set ${setCode} page ${page}:`, error)
      hasMore = false
    }
  }
  
  return results
}

/**
 * Get random Arena cards for testing/seeding
 */
export async function getRandomArenaCards(count: number = 10): Promise<LocalizedCardData[]> {
  const results: LocalizedCardData[] = []
  
  for (let i = 0; i < Math.ceil(count / 175); i++) {
    try {
      const response = await fetch(
        `${SCRYFALL_API_BASE}/cards/random?q=game:arena`,
        {
          headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
        }
      )
      
      if (response.ok) {
        const card = await response.json()
        const localized = await fetchCardWithLocalizations(card.id)
        if (localized) {
          results.push(localized)
        }
      }
      
      await sleep(RATE_LIMIT_DELAY)
      
      if (results.length >= count) {
        break
      }
      
    } catch (error) {
      console.error('Error fetching random card:', error)
    }
  }
  
  return results.slice(0, count)
}

/**
 * Merge English and Italian card data
 */
function mergeCardLocalizations(
  english: ScryfallCard, 
  italian?: ScryfallCard
): LocalizedCardData['merged'] {
  const types = english.type_line ? english.type_line.split(' — ').flatMap(part => 
    part.split(' ').filter(word => word.trim())
  ) : []
  
  return {
    id: english.id,
    scryfall_id: english.id,
    name: english.name,
    name_it: italian?.printed_name || italian?.name,
    oracle_text: english.oracle_text || '',
    flavor_text: english.flavor_text,
    flavor_text_it: italian?.flavor_text,
    mana_cost: english.mana_cost,
    cmc: english.cmc,
    colors: english.colors || [],
    color_identity: english.color_identity || [],
    types,
    keywords: english.keywords || [],
    produced_mana: english.produced_mana || [],
    set_code: english.set,
    set_name: english.set_name,
    collector_number: english.collector_number,
    rarity: english.rarity,
    image_url: english.image_uris?.normal,
    image_uris: english.image_uris ? JSON.parse(JSON.stringify(english.image_uris)) : undefined,
    artwork_uri: english.image_uris?.art_crop,
    legal_standard: english.legalities?.standard === 'legal',
    legal_historic: english.legalities?.historic === 'legal',
    legal_brawl: english.legalities?.brawl === 'legal',
    in_arena: english.games?.includes('arena') || false,
    scryfall_uri: english.scryfall_uri,
    scryfall_synced_at: new Date().toISOString()
  }
}

/**
 * Check if a card needs Scryfall sync (no sync in last 7 days)
 */
export function needsScryfallSync(lastSyncDate?: string | null): boolean {
  if (!lastSyncDate) return true
  
  const lastSync = new Date(lastSyncDate)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  
  return lastSync < weekAgo
}

/**
 * Batch process cards for localization
 */
export async function batchLocalizeCards(
  scryfallIds: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<LocalizedCardData[]> {
  const results: LocalizedCardData[] = []
  
  for (let i = 0; i < scryfallIds.length; i++) {
    try {
      const localized = await fetchCardWithLocalizations(scryfallIds[i])
      if (localized) {
        results.push(localized)
      }
      
      if (onProgress) {
        onProgress(i + 1, scryfallIds.length)
      }
      
      await sleep(RATE_LIMIT_DELAY)
      
    } catch (error) {
      console.error(`Error localizing card ${scryfallIds[i]}:`, error)
    }
  }
  
  return results
}

/**
 * Validate card data before database insertion
 */
export function validateCardData(cardData: LocalizedCardData['merged']): boolean {
  return !!(
    cardData.scryfall_id &&
    cardData.name &&
    cardData.set_code &&
    cardData.scryfall_uri
  )
}

// Export for backward compatibility
export type Card = ScryfallCard
export { searchArenaCards as fetchArenaStandardCards }