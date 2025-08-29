// src/lib/scryfall-enhanced.ts
// Enhanced Scryfall integration per immagini e nomi italiani - VERSIONE CORRETTA

interface ScryfallCard {
  id: string
  oracle_id: string
  name: string
  printed_name?: string
  lang: string
  mana_cost?: string
  cmc?: number
  colors?: string[]
  color_identity?: string[]
  type_line?: string
  printed_type_line?: string
  oracle_text?: string
  printed_text?: string
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
}

interface LocalizedCardData {
  english: ScryfallCard
  italian?: ScryfallCard
  merged: {
    id: string
    scryfall_id: string
    oracle_id: string
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
 * METODO CORRETTO: usa oracle_id per matchare le traduzioni
 */
export async function fetchCardWithLocalizations(
  scryfallId: string
): Promise<LocalizedCardData | null> {
  try {
    // Step 1: Fetch English version
    const englishResponse = await fetch(`${SCRYFALL_API_BASE}/cards/${scryfallId}?format=json`, {
      headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
    })
    
    if (!englishResponse.ok) {
      throw new Error(`Failed to fetch English card: ${englishResponse.status}`)
    }
    
    const english: ScryfallCard = await englishResponse.json()
    await sleep(RATE_LIMIT_DELAY)
    
    // Step 2: Search for Italian version using oracle_id
    let italian: ScryfallCard | undefined
    
    try {
      const italianSearchUrl = `${SCRYFALL_API_BASE}/cards/search?q=oracle_id:${english.oracle_id}+lang:it&unique=prints`
      const italianResponse = await fetch(italianSearchUrl, {
        headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
      })
      
      if (italianResponse.ok) {
        const italianData = await italianResponse.json()
        if (italianData.data && italianData.data.length > 0) {
          // Prendi la prima versione italiana trovata
          italian = italianData.data[0]
        }
      }
    } catch (error) {
      console.log(`No Italian translation found for ${english.name} (oracle_id: ${english.oracle_id})`)
    }
    
    await sleep(RATE_LIMIT_DELAY)
    
    // Step 3: Merge data
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
 * Batch search for Italian cards using oracle_ids
 * NUOVO METODO: cerca direttamente carte italiane
 */
export async function searchItalianCardsByOracleIds(
  oracleIds: string[]
): Promise<{ [oracleId: string]: ScryfallCard }> {
  const italianCards: { [oracleId: string]: ScryfallCard } = {}
  
  // Batch search per gruppi di 75 oracle_ids (limite Scryfall)
  const batchSize = 75
  for (let i = 0; i < oracleIds.length; i += batchSize) {
    const batch = oracleIds.slice(i, i + batchSize)
    
    try {
      // Crea query OR con tutti gli oracle_id del batch
      const oracleQuery = batch.map(id => `oracle_id:${id}`).join(' OR ')
      const searchUrl = `${SCRYFALL_API_BASE}/cards/search?q=(${oracleQuery})+lang:it&unique=prints`
      
      const response = await fetch(searchUrl, {
        headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          // Mappa ogni carta italiana al suo oracle_id
          for (const card of data.data) {
            if (!italianCards[card.oracle_id]) {
              italianCards[card.oracle_id] = card
            }
          }
        }
      }
      
      await sleep(RATE_LIMIT_DELAY)
      
    } catch (error) {
      console.error(`Error searching Italian cards batch ${i}-${i + batchSize}:`, error)
    }
  }
  
  return italianCards
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
 * VERSIONE CORRETTA: usa printed_name dal campo della carta italiana
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
    oracle_id: english.oracle_id,
    name: english.name,
    // CORREZIONE: usa printed_name dalla carta italiana
    name_it: italian?.printed_name || italian?.name,
    oracle_text: english.oracle_text || '',
    flavor_text: english.flavor_text,
    // CORREZIONE: usa printed_text per flavor text italiano  
    flavor_text_it: italian?.printed_text?.split('\n').pop(), // Ultimo paragrafo spesso è flavor text
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
 * Batch process cards for localization - VERSIONE OTTIMIZZATA
 */
export async function batchLocalizeCards(
  scryfallIds: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<LocalizedCardData[]> {
  const results: LocalizedCardData[] = []
  
  // Step 1: Fetch tutte le carte inglesi
  const englishCards: ScryfallCard[] = []
  for (let i = 0; i < scryfallIds.length; i++) {
    try {
      const response = await fetch(`${SCRYFALL_API_BASE}/cards/${scryfallIds[i]}`, {
        headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
      })
      
      if (response.ok) {
        const card = await response.json()
        englishCards.push(card)
      }
      
      await sleep(RATE_LIMIT_DELAY)
      
      if (onProgress) {
        onProgress(i + 1, scryfallIds.length)
      }
      
    } catch (error) {
      console.error(`Error fetching English card ${scryfallIds[i]}:`, error)
    }
  }
  
  // Step 2: Batch search per carte italiane usando oracle_ids
  const oracleIds = englishCards.map(card => card.oracle_id)
  const italianCards = await searchItalianCardsByOracleIds(oracleIds)
  
  // Step 3: Merge dei dati
  for (const englishCard of englishCards) {
    const italianCard = italianCards[englishCard.oracle_id]
    const merged = mergeCardLocalizations(englishCard, italianCard)
    
    results.push({
      english: englishCard,
      italian: italianCard,
      merged
    })
  }
  
  return results
}

/**
 * Validate card data before database insertion
 */
export function validateCardData(cardData: LocalizedCardData['merged']): boolean {
  return !!(
    cardData.scryfall_id &&
    cardData.oracle_id &&
    cardData.name &&
    cardData.set_code &&
    cardData.scryfall_uri
  )
}

// Export for backward compatibility
export type Card = ScryfallCard
export { searchArenaCards as fetchArenaStandardCards }