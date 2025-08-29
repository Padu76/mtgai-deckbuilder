// src/app/api/ai/analyze-combos/route.ts
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

interface ComboPattern {
  id: string
  cards: Card[]
  category: string
  type: 'infinite' | 'synergy' | 'win_condition' | 'value_engine'
  description: string
  steps: string[]
  reliability: 'high' | 'medium' | 'low'
  setup_turns: number
  mana_cost_total: number
  power_level: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { colors, format = 'historic', max_combos = 20 } = body

    if (!colors || colors.length === 0) {
      return NextResponse.json({ 
        error: 'Colors array is required',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Starting combo analysis for colors: ${colors.join(', ')}, format: ${format}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get cards with null safety
    const { data: cards, error } = await supabase
      .from('cards')
      .select('*')
      .eq('arena_legal', true)
      .not('oracle_text', 'is', null)
      .limit(1000)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        error: 'Database error: ' + error.message,
        ok: false 
      }, { status: 500 })
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ 
        error: 'No cards found in database',
        ok: false 
      }, { status: 404 })
    }

    console.log(`Analyzing ${cards.length} cards for combo potential...`)

    // Safe card filtering with null checks
    const validCards = cards.filter(card => {
      try {
        // Ensure required fields exist and are valid
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        if (!Array.isArray(card.color_identity)) return false
        if (!Array.isArray(card.types)) return false
        
        // Check if card matches selected colors (empty color_identity = colorless is ok)
        const cardColors = card.color_identity || []
        return cardColors.length === 0 || cardColors.some((color: string) => colors.includes(color))
      } catch (e) {
        console.warn(`Card validation error for card ${card.id}:`, e)
        return false
      }
    })

    console.log(`Filtered to ${validCards.length} valid cards`)

    // AI analysis with fallback patterns
    let combos: ComboPattern[] = []
    
    try {
      // Try AI analysis first if API key is available
      if (process.env.ANTHROPIC_API_KEY) {
        combos = await analyzeWithAI(validCards, colors)
      }
    } catch (aiError) {
      console.warn('AI analysis failed, using fallback patterns:', aiError)
    }

    // Fallback to pattern-based analysis if AI fails or no API key
    if (combos.length === 0) {
      combos = await analyzeWithPatterns(validCards, colors)
    }

    // Limit results
    combos = combos.slice(0, max_combos)

    console.log(`Found ${combos.length} combo suggestions`)

    // Safe categorization
    const categories = combos.reduce((acc: any, combo) => {
      const category = combo.category || 'unknown'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      ok: true,
      combos,
      categories,
      total_cards_analyzed: validCards.length,
      colors_requested: colors,
      format
    })

  } catch (error: any) {
    console.error('Error with AI analysis:', error)
    return NextResponse.json({ 
      error: 'Analysis failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

async function analyzeWithAI(cards: Card[], colors: string[]): Promise<ComboPattern[]> {
  // AI analysis implementation (requires ANTHROPIC_API_KEY)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ANTHROPIC_API_KEY!
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Analyze these MTG cards for combo potential. Colors: ${colors.join(',')}.
        Find synergistic combinations focusing on: infinite combos, value engines, win conditions.
        Cards sample: ${cards.slice(0, 50).map(c => `${c.name}: ${c.oracle_text?.slice(0, 100)}`).join('\n')}
        
        Return JSON array of combos with this structure:
        [{"id": "combo1", "category": "infinite_tokens", "description": "...", "cards": [...], "steps": [...], "reliability": "high", "setup_turns": 3, "mana_cost_total": 6, "power_level": 8}]`
      }]
    })
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text || ''
  
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.warn('Failed to parse AI response as JSON')
  }
  
  return []
}

async function analyzeWithPatterns(cards: Card[], colors: string[]): Promise<ComboPattern[]> {
  const combos: ComboPattern[] = []
  
  // Define combo patterns with null safety
  const patterns = [
    {
      id: 'poison_proliferate',
      category: 'poison',
      keywords: ['poison', 'toxic', 'proliferate'],
      description: 'Combo Veleno + Proliferate',
      power_level: 7,
      setup_turns: 4
    },
    {
      id: 'infinite_tokens',
      category: 'infinite_tokens', 
      keywords: ['create', 'token', 'copy', 'populate'],
      description: 'Generazione Infinita Pedine',
      power_level: 8,
      setup_turns: 5
    },
    {
      id: 'infinite_mana',
      category: 'infinite_mana',
      keywords: ['add', 'mana', 'untap', 'cost reduction'],
      description: 'Generazione Mana Infinito',
      power_level: 9,
      setup_turns: 3
    },
    {
      id: 'sacrifice_synergy',
      category: 'value_engine',
      keywords: ['sacrifice', 'death', 'enters', 'leaves'],
      description: 'Sinergie Sacrifice/Death Trigger',
      power_level: 6,
      setup_turns: 3
    },
    {
      id: 'draw_mill',
      category: 'draw_damage',
      keywords: ['draw', 'mill', 'library', 'graveyard'],
      description: 'Mill + Punishment Engine',
      power_level: 6,
      setup_turns: 4
    }
  ]

  // Safe pattern matching
  for (const pattern of patterns) {
    try {
      const matchingCards = cards.filter(card => {
        if (!card.oracle_text) return false
        const text = card.oracle_text.toLowerCase()
        return pattern.keywords.some(keyword => text.includes(keyword.toLowerCase()))
      }).slice(0, 4) // Limit cards per combo

      if (matchingCards.length >= 2) {
        // Safe card processing
        const processedCards = matchingCards.map(card => ({
          id: card.id || '',
          name: card.name || 'Unknown Card',
          mana_cost: card.mana_cost || '',
          mana_value: card.mana_value || 0,
          colors: Array.isArray(card.colors) ? card.colors : [],
          color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
          oracle_text: card.oracle_text || '',
          rarity: card.rarity || 'common',
          types: Array.isArray(card.types) ? card.types : [],
          power: card.power || null,
          toughness: card.toughness || null,
          set_code: card.set_code || null,
          image_url: card.image_url || null
        }))

        const totalManaCost = processedCards.reduce((sum, card) => 
          sum + (card.mana_value || 0), 0)

        combos.push({
          id: `${pattern.id}_${Date.now()}`,
          cards: processedCards,
          category: pattern.category,
          type: 'synergy',
          description: pattern.description,
          steps: [
            `Deploy ${processedCards[0]?.name || 'first card'}`,
            `Set up ${processedCards[1]?.name || 'second card'}`,
            `Execute combo for advantage`
          ],
          reliability: totalManaCost <= 6 ? 'high' : 'medium',
          setup_turns: pattern.setup_turns,
          mana_cost_total: totalManaCost,
          power_level: pattern.power_level
        })
      }
    } catch (patternError) {
      console.warn(`Error processing pattern ${pattern.id}:`, patternError)
      continue
    }
  }

  // Ensure we return at least some combos
  if (combos.length === 0) {
    // Generate a basic combo from any available cards
    const sampleCards = cards.slice(0, 3).map(card => ({
      id: card.id || '',
      name: card.name || 'Unknown Card',
      mana_cost: card.mana_cost || '',
      mana_value: card.mana_value || 0,
      colors: Array.isArray(card.colors) ? card.colors : [],
      color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
      oracle_text: card.oracle_text || '',
      rarity: card.rarity || 'common',
      types: Array.isArray(card.types) ? card.types : [],
      power: card.power || null,
      toughness: card.toughness || null,
      set_code: card.set_code || null,
      image_url: card.image_url || null
    }))

    if (sampleCards.length >= 2) {
      combos.push({
        id: 'basic_synergy',
        cards: sampleCards,
        category: 'value_engine',
        type: 'synergy',
        description: `Sinergia Base ${colors.join('-')}`,
        steps: ['Deploy creatures', 'Build board presence', 'Apply pressure'],
        reliability: 'medium',
        setup_turns: 4,
        mana_cost_total: 8,
        power_level: 5
      })
    }
  }

  return combos
}