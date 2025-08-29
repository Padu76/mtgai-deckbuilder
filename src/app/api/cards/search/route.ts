// src/app/api/cards/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Card {
  id: string
  name: string
  mana_cost: string | null
  mana_value: number | null
  colors: string[]
  color_identity: string[]
  types: string[]
  oracle_text: string | null
  power: string | null
  toughness: string | null
  rarity: string | null
  set_code: string | null
  image_url: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      query, 
      limit = 20, 
      format = 'standard',
      colors = [],
      types = [],
      mana_value_min = 0,
      mana_value_max = 20,
      rarity = []
    } = body

    if (!query || typeof query !== 'string' || query.length < 2) {
      return NextResponse.json({ 
        error: 'Query must be at least 2 characters',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Searching cards: "${query}" (limit: ${limit})`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Build query
    let searchQuery = supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)

    // Text search - try exact name first, then partial
    const sanitizedQuery = query.trim().replace(/'/g, "''")
    searchQuery = searchQuery.or(`name.ilike.%${sanitizedQuery}%,oracle_text.ilike.%${sanitizedQuery}%`)

    // Apply filters
    if (colors.length > 0) {
      // Filter by color identity
      const colorConditions = colors.map((color: string) => `color_identity.cs.{${color}}`).join(',')
      searchQuery = searchQuery.or(colorConditions)
    }

    if (types.length > 0) {
      // Filter by card types
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

    // Score and sort results by relevance
    const scoredResults = validCards.map((card: Card) => {
      let score = 0
      const cardName = card.name.toLowerCase()
      const searchTerm = query.toLowerCase()
      
      // Exact name match gets highest score
      if (cardName === searchTerm) {
        score += 100
      }
      // Name starts with query gets high score
      else if (cardName.startsWith(searchTerm)) {
        score += 50
      }
      // Name contains query gets medium score
      else if (cardName.includes(searchTerm)) {
        score += 25
      }
      
      // Oracle text contains query gets lower score
      if (card.oracle_text && card.oracle_text.toLowerCase().includes(searchTerm)) {
        score += 10
      }
      
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

      return { card, score }
    })

    // Sort by score and return top results
    const finalResults = scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.card)

    console.log(`Found ${finalResults.length} cards for "${query}"`)

    // Add search suggestions if few results
    let suggestions: string[] = []
    if (finalResults.length < 5 && query.length >= 3) {
      suggestions = generateSearchSuggestions(query, validCards)
    }

    return NextResponse.json({
      ok: true,
      cards: finalResults,
      total_found: finalResults.length,
      query: query,
      suggestions,
      filters_applied: {
        colors: colors.length > 0 ? colors : undefined,
        types: types.length > 0 ? types : undefined,
        mana_range: mana_value_min > 0 || mana_value_max < 20 ? [mana_value_min, mana_value_max] : undefined,
        rarity: rarity.length > 0 ? rarity : undefined
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

function generateSearchSuggestions(query: string, allCards: Card[]): string[] {
  const suggestions: string[] = []
  const queryLower = query.toLowerCase()
  
  // Find cards with similar names
  const similarNames = allCards
    .filter(card => {
      const name = card.name.toLowerCase()
      return name.includes(queryLower.slice(0, -1)) || // Remove last character
             queryLower.includes(name.slice(0, -1)) ||  // Remove last character from card name
             levenshteinDistance(name, queryLower) <= 2 // Similar spelling
    })
    .map(card => card.name)
    .slice(0, 3)

  suggestions.push(...similarNames)

  // Add common search terms if no good matches
  if (suggestions.length === 0) {
    const commonTerms = [
      'Lightning Bolt', 'Counterspell', 'Giant Growth', 'Healing Salve',
      'Dark Ritual', 'Sol Ring', 'Command Tower', 'Evolving Wilds',
      'Llanowar Elves', 'Serra Angel', 'Shivan Dragon', 'Force of Will'
    ]
    
    suggestions.push(...commonTerms.filter(term => 
      term.toLowerCase().includes(queryLower) ||
      queryLower.includes(term.toLowerCase().slice(0, 3))
    ).slice(0, 3))
  }

  return suggestions
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