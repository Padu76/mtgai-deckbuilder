// src/app/api/cards/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Card {
  id: string
  name: string
  name_italian?: string | null
  mana_cost: string | null
  mana_value: number | null
  colors: string[]
  color_identity: string[]
  types: string[]
  oracle_text: string | null
  oracle_text_italian?: string | null
  power: string | null
  toughness: string | null
  rarity: string | null
  set_code: string | null
  image_url: string | null
  foreign_names?: Array<{
    language: string
    name: string
    text?: string
  }>
}

// Supporta sia GET che POST
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || searchParams.get('query') || ''
  const limit = parseInt(searchParams.get('limit') || '20')
  const format = searchParams.get('format') || 'standard'
  const colors = searchParams.get('colors')?.split(',') || []
  const types = searchParams.get('types')?.split(',') || []
  const mana_value_min = parseInt(searchParams.get('mana_min') || '0')
  const mana_value_max = parseInt(searchParams.get('mana_max') || '20')
  const rarity = searchParams.get('rarity')?.split(',') || []

  return await searchCards({
    query,
    limit,
    format,
    colors,
    types,
    mana_value_min,
    mana_value_max,
    rarity
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return await searchCards(body)
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Invalid JSON body: ' + error.message,
      ok: false 
    }, { status: 400 })
  }
}

async function searchCards(params: {
  query: string
  limit?: number
  format?: string
  colors?: string[]
  types?: string[]
  mana_value_min?: number
  mana_value_max?: number
  rarity?: string[]
}) {
  try {
    const { 
      query, 
      limit = 20, 
      format = 'standard',
      colors = [],
      types = [],
      mana_value_min = 0,
      mana_value_max = 20,
      rarity = []
    } = params

    if (!query || typeof query !== 'string' || query.length < 2) {
      return NextResponse.json({ 
        error: 'Query must be at least 2 characters',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Searching cards: "${query}" (limit: ${limit})`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Normalizza la query per ricerca italiana
    const normalizedQuery = normalizeItalianText(query.trim())
    const sanitizedQuery = query.trim().replace(/'/g, "''")
    const sanitizedNormalized = normalizedQuery.replace(/'/g, "''")

    // Build query base
    let searchQuery = supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)

    // Multi-language search: English + Italian
    const searchConditions = [
      // Ricerca inglese (esistente)
      `name.ilike.%${sanitizedQuery}%`,
      `oracle_text.ilike.%${sanitizedQuery}%`,
      
      // Ricerca italiana - nomi tradotti
      `name_italian.ilike.%${sanitizedQuery}%`,
      `oracle_text_italian.ilike.%${sanitizedQuery}%`,
      
      // Ricerca italiana normalizzata (senza accenti)
      `name_italian.ilike.%${sanitizedNormalized}%`,
      `oracle_text_italian.ilike.%${sanitizedNormalized}%`,
      
      // Foreign names JSON search per italiano
      `foreign_names::text.ilike.%${sanitizedQuery}%`
    ]

    searchQuery = searchQuery.or(searchConditions.join(','))

    // Apply filters
    if (colors.length > 0) {
      const colorConditions = colors.map((color: string) => `color_identity.cs.{${color}}`).join(',')
      searchQuery = searchQuery.or(colorConditions)
    }

    if (types.length > 0) {
      const typeConditions = types.map((type: string) => `types.cs.{${type}}`).join(',')
      searchQuery = searchQuery.or(typeConditions)
    }

    // Mana value range
    if (mana_value_min > 0) {
      searchQuery = searchQuery.gte('mana_value', mana_value_min)
    }
    if (mana_value_max < 20) {
      searchQuery = searchQuery.lte('mana_value', mana_value_max)
    }

    // Rarity filter
    if (rarity.length > 0) {
      searchQuery = searchQuery.in('rarity', rarity)
    }

    // Execute search with limit
    const { data: searchResults, error } = await searchQuery
      .limit(Math.min(limit, 100))
      .order('name')

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json({ 
        error: 'Search failed: ' + error.message,
        ok: false 
      }, { status: 500 })
    }

    // Safe card processing
    const validCards = (searchResults || []).filter((card: Card) => {
      try {
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        return true
      } catch (e) {
        return false
      }
    })

    // Enhanced scoring with Italian support
    const scoredResults = validCards.map((card: Card) => {
      let score = 0
      const cardNameEn = card.name.toLowerCase()
      const cardNameIt = card.name_italian?.toLowerCase() || ''
      const searchTerm = query.toLowerCase()
      const normalizedSearch = normalizeItalianText(searchTerm)
      
      // EXACT MATCHES (highest priority)
      if (cardNameEn === searchTerm || cardNameIt === searchTerm) {
        score += 200
      }
      // Normalized Italian exact match
      else if (normalizeItalianText(cardNameIt) === normalizedSearch) {
        score += 190
      }
      
      // NAME STARTS WITH (high priority)
      else if (cardNameEn.startsWith(searchTerm)) {
        score += 100
      }
      else if (cardNameIt.startsWith(searchTerm)) {
        score += 95
      }
      else if (normalizeItalianText(cardNameIt).startsWith(normalizedSearch)) {
        score += 90
      }
      
      // NAME CONTAINS (medium priority)
      else if (cardNameEn.includes(searchTerm)) {
        score += 50
      }
      else if (cardNameIt.includes(searchTerm)) {
        score += 45
      }
      else if (normalizeItalianText(cardNameIt).includes(normalizedSearch)) {
        score += 40
      }
      
      // ORACLE TEXT CONTAINS (lower priority)
      if (card.oracle_text && card.oracle_text.toLowerCase().includes(searchTerm)) {
        score += 20
      }
      if (card.oracle_text_italian && card.oracle_text_italian.toLowerCase().includes(searchTerm)) {
        score += 18
      }
      if (card.oracle_text_italian && normalizeItalianText(card.oracle_text_italian).includes(normalizedSearch)) {
        score += 15
      }
      
      // FOREIGN NAMES CHECK (for cards with foreign_names JSON)
      if (card.foreign_names && Array.isArray(card.foreign_names)) {
        const italianName = card.foreign_names.find(fn => fn.language === 'Italian')
        if (italianName) {
          const foreignName = italianName.name.toLowerCase()
          if (foreignName === searchTerm) score += 180
          else if (foreignName.startsWith(searchTerm)) score += 85
          else if (foreignName.includes(searchTerm)) score += 35
          else if (normalizeItalianText(foreignName).includes(normalizedSearch)) score += 30
        }
      }
      
      // BONUS SCORING
      // Prefer more popular rarities for general searches
      switch (card.rarity) {
        case 'common': score += 3; break
        case 'uncommon': score += 2; break
        case 'rare': score += 4; break
        case 'mythic': score += 5; break
      }

      // Prefer lower mana costs for playability
      const manaCost = card.mana_value || 0
      if (manaCost <= 3) score += 2
      else if (manaCost <= 6) score += 1

      // Prefer cards with Italian translation
      if (card.name_italian) score += 1

      return { card, score }
    })

    // Sort by score and return top results
    const finalResults = scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.card)

    console.log(`Found ${finalResults.length} cards for "${query}"`)
    
    // Enhanced search suggestions with Italian support
    let suggestions: string[] = []
    if (finalResults.length < 5 && query.length >= 3) {
      suggestions = generateItalianSearchSuggestions(query, validCards)
    }

    return NextResponse.json({
      ok: true,
      cards: finalResults,
      total_found: finalResults.length,
      query: query,
      normalized_query: normalizedQuery,
      suggestions,
      filters_applied: {
        colors: colors.length > 0 ? colors : undefined,
        types: types.length > 0 ? types : undefined,
        mana_range: mana_value_min > 0 || mana_value_max < 20 ? [mana_value_min, mana_value_max] : undefined,
        rarity: rarity.length > 0 ? rarity : undefined
      },
      search_info: {
        supports_italian: true,
        supports_methods: ['GET', 'POST'],
        accent_normalization: true
      }
    })

  } catch (error: any) {
    console.error('Cards search error:', error)
    return NextResponse.json({ 
      error: 'Search failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

// Normalizza testo italiano rimuovendo accenti e caratteri speciali
function normalizeItalianText(text: string): string {
  if (!text) return ''
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Rimuove accenti
    .replace(/['']/g, "'") // Normalizza apostrofi
    .replace(/[«»""]/g, '"') // Normalizza virgolette
    .replace(/[–—]/g, '-') // Normalizza trattini
    .trim()
}

// Genera suggerimenti di ricerca includendo nomi italiani comuni
function generateItalianSearchSuggestions(query: string, allCards: Card[]): string[] {
  const suggestions: string[] = []
  const queryLower = query.toLowerCase()
  const normalizedQuery = normalizeItalianText(query)
  
  // Find cards with similar names (English + Italian)
  const similarNames = allCards
    .filter(card => {
      const nameEn = card.name.toLowerCase()
      const nameIt = card.name_italian?.toLowerCase() || ''
      const normalizedIt = normalizeItalianText(nameIt)
      
      return nameEn.includes(queryLower.slice(0, -1)) || 
             nameIt.includes(queryLower.slice(0, -1)) ||
             normalizedIt.includes(normalizedQuery.slice(0, -1)) ||
             queryLower.includes(nameEn.slice(0, -1)) ||
             queryLower.includes(nameIt.slice(0, -1)) ||
             normalizedQuery.includes(normalizedIt.slice(0, -1)) ||
             levenshteinDistance(nameEn, queryLower) <= 2 ||
             levenshteinDistance(nameIt, queryLower) <= 2 ||
             levenshteinDistance(normalizedIt, normalizedQuery) <= 2
    })
    .map(card => ({
      english: card.name,
      italian: card.name_italian || card.name
    }))
    .slice(0, 3)

  // Add both English and Italian versions
  similarNames.forEach(names => {
    suggestions.push(names.italian)
    if (names.english !== names.italian) {
      suggestions.push(names.english)
    }
  })

  // Add common Italian MTG terms if no good matches
  if (suggestions.length === 0) {
    const commonItalianCards = [
      // Carte base popolari in italiano
      'Fulmine', 'Contromagia', 'Crescita Gigante', 'Balsamo Risanante',
      'Rituale Oscuro', 'Anello del Sole', 'Torre di Comando', 'Terreni Selvaggi in Evoluzione',
      'Elfi di Llanowar', 'Angelo Serra', 'Drago di Shiv', 'Forza di Volontà',
      
      // Anche versioni inglesi famose
      'Lightning Bolt', 'Counterspell', 'Giant Growth', 'Healing Salve',
      'Dark Ritual', 'Sol Ring', 'Command Tower', 'Evolving Wilds',
      'Llanowar Elves', 'Serra Angel', 'Shivan Dragon', 'Force of Will'
    ]
    
    const matchingTerms = commonItalianCards.filter(term => {
      const termLower = term.toLowerCase()
      const normalizedTerm = normalizeItalianText(term)
      return termLower.includes(queryLower) ||
             queryLower.includes(termLower.slice(0, 3)) ||
             normalizedTerm.includes(normalizedQuery) ||
             normalizedQuery.includes(normalizedTerm.slice(0, 3))
    }).slice(0, 3)
    
    suggestions.push(...matchingTerms)
  }

  // Remove duplicates and return
  return [...new Set(suggestions)].slice(0, 5)
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}