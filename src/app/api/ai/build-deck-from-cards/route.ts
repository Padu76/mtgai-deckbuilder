// src/app/api/ai/build-deck-from-cards/route.ts
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

interface SeedCard {
  card: Card
  quantity: number
}

interface BuildStrategy {
  strategy_type: 'combo' | 'aggro' | 'control' | 'ramp' | 'tribal' | 'artifacts' | 'enchantments' | 'value_engine'
  focus_areas: string[]
  mana_curve_preference: 'low' | 'mid' | 'high' | 'balanced'
  interaction_level: 'minimal' | 'moderate' | 'heavy'
}

interface DeckSuggestion {
  cards: Array<{
    card: Card
    quantity: number
    role: string
    reasoning: string
  }>
  total_cards: number
  strategy_analysis: string
  mana_base_suggestion: Card[]
  curve_analysis: Record<string, number>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      seed_cards, 
      strategy, 
      format = 'standard',
      target_cards = 60 
    } = body

    if (!seed_cards || seed_cards.length === 0) {
      return NextResponse.json({ 
        error: 'At least one seed card is required',
        ok: false 
      }, { status: 400 })
    }

    if (seed_cards.length > 20) {
      return NextResponse.json({ 
        error: 'Maximum 20 seed cards allowed',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Building deck from ${seed_cards.length} seed cards with ${strategy.strategy_type} strategy`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get card pool
    const { data: cardPool, error } = await supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)
      .limit(2500)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        error: 'Database error: ' + error.message,
        ok: false 
      }, { status: 500 })
    }

    // Safe card filtering
    const validCards = (cardPool || []).filter((card: Card) => {
      try {
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        if (!Array.isArray(card.color_identity)) return false
        if (!Array.isArray(card.types)) return false
        return true
      } catch (e) {
        return false
      }
    })

    // Analyze seed cards
    const seedAnalysis = analyzeSeedCards(seed_cards)
    console.log('Seed analysis:', seedAnalysis)

    // Build deck with AI strategy
    const deckSuggestion = await buildDeckWithStrategy(
      seed_cards,
      strategy,
      validCards,
      format,
      target_cards,
      seedAnalysis
    )

    return NextResponse.json({
      ok: true,
      seed_cards_count: seed_cards.length,
      strategy: strategy.strategy_type,
      deck_suggestion: deckSuggestion,
      format,
      analysis: seedAnalysis
    })

  } catch (error: any) {
    console.error('Error building deck from cards:', error)
    return NextResponse.json({ 
      error: 'Deck building failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

function analyzeSeedCards(seedCards: SeedCard[]) {
  const totalCards = seedCards.reduce((sum: number, seed: SeedCard) => sum + seed.quantity, 0)
  
  const colorDistribution: Record<string, number> = {}
  const typeDistribution: Record<string, number> = {}
  const manaCurve: Record<string, number> = {}
  const keywordFrequency: Record<string, number> = {}

  for (const seed of seedCards) {
    const card = seed.card
    const quantity = seed.quantity

    // Colors
    if (Array.isArray(card.colors)) {
      for (const color of card.colors) {
        colorDistribution[color] = (colorDistribution[color] || 0) + quantity
      }
    }

    // Types  
    if (Array.isArray(card.types)) {
      for (const type of card.types) {
        typeDistribution[type] = (typeDistribution[type] || 0) + quantity
      }
    }

    // Mana curve
    const cmc = Math.min(card.mana_value || 0, 7)
    const key = cmc === 7 ? '7+' : cmc.toString()
    manaCurve[key] = (manaCurve[key] || 0) + quantity

    // Keywords analysis
    const text = (card.oracle_text || '').toLowerCase()
    const keywords = [
      'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
      'draw', 'search', 'destroy', 'exile', 'counter', 'create', 'token',
      'sacrifice', 'enters', 'dies', 'triggered', 'activated'
    ]
    
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + quantity
      }
    }
  }

  // Determine dominant patterns
  const dominantColors = Object.entries(colorDistribution)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([color]) => color)

  const dominantTypes = Object.entries(typeDistribution)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([type]) => type)

  const dominantKeywords = Object.entries(keywordFrequency)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([keyword]) => keyword)

  const avgManaCost = totalCards > 0 ? 
    seedCards.reduce((sum: number, seed: SeedCard) => 
      sum + (seed.card.mana_value || 0) * seed.quantity, 0) / totalCards : 0

  return {
    total_cards: totalCards,
    color_distribution: colorDistribution,
    dominant_colors: dominantColors,
    type_distribution: typeDistribution,
    dominant_types: dominantTypes,
    mana_curve: manaCurve,
    avg_mana_cost: avgManaCost,
    keyword_frequency: keywordFrequency,
    dominant_keywords: dominantKeywords,
    suggested_archetype: inferArchetype(dominantKeywords, dominantTypes, avgManaCost)
  }
}

function inferArchetype(keywords: string[], types: string[], avgCost: number): string {
  if (keywords.includes('haste') && avgCost <= 3) return 'aggro'
  if (keywords.includes('counter') || keywords.includes('draw')) return 'control'  
  if (keywords.includes('create') && keywords.includes('token')) return 'tokens'
  if (keywords.includes('sacrifice') && keywords.includes('dies')) return 'sacrifice'
  if (types.includes('Artifact')) return 'artifacts'
  if (types.includes('Enchantment')) return 'enchantments'
  if (avgCost >= 5) return 'ramp'
  return 'midrange'
}

async function buildDeckWithStrategy(
  seedCards: SeedCard[],
  strategy: BuildStrategy,
  cardPool: Card[],
  format: string,
  targetCards: number,
  analysis: any
): Promise<DeckSuggestion> {

  const suggestions: Array<{
    card: Card
    quantity: number
    role: string
    reasoning: string
  }> = []

  const usedCardIds = new Set(seedCards.map((seed: SeedCard) => seed.card.id))
  const dominantColors = analysis.dominant_colors
  const cardsNeeded = targetCards - analysis.total_cards

  // Strategy-specific card categories
  const strategyCategories = getStrategySupportCategories(strategy, analysis)

  // Filter card pool by colors and strategy
  const compatibleCards = cardPool.filter((card: Card) => {
    if (usedCardIds.has(card.id)) return false
    
    // Color compatibility
    const cardColors = card.color_identity || []
    if (cardColors.length > 0) {
      const hasCompatibleColors = cardColors.every((color: string) => dominantColors.includes(color))
      if (!hasCompatibleColors) return false
    }

    return true
  })

  // Add cards by category priority
  let cardsAdded = 0
  for (const category of strategyCategories) {
    if (cardsAdded >= cardsNeeded) break

    const categoryCards = compatibleCards
      .filter((card: Card) => {
        try {
          return category.filter(card)
        } catch (e) {
          return false
        }
      })
      .sort((a: Card, b: Card) => {
        // Sort by strategy preferences
        if (strategy.mana_curve_preference === 'low') {
          return (a.mana_value || 0) - (b.mana_value || 0)
        } else if (strategy.mana_curve_preference === 'high') {
          return (b.mana_value || 0) - (a.mana_value || 0)
        }
        return (a.mana_value || 0) - (b.mana_value || 0)
      })
      .slice(0, category.max_cards)

    for (const card of categoryCards) {
      if (cardsAdded >= cardsNeeded) break
      
      const quantity = format === 'brawl' ? 1 : Math.min(4, category.preferred_quantity || 2)
      suggestions.push({
        card,
        quantity,
        role: category.name,
        reasoning: category.reasoning
      })
      
      usedCardIds.add(card.id)
      cardsAdded += quantity
    }
  }

  // Add mana base
  const manaBaseSuggestion = generateManaBase(dominantColors, format, targetCards)

  // Calculate final curve
  const allCards = [
    ...seedCards.map((seed: SeedCard) => ({ card: seed.card, quantity: seed.quantity })),
    ...suggestions,
    ...manaBaseSuggestion.map((card: Card) => ({ card, quantity: format === 'brawl' ? 1 : 4 }))
  ]

  const finalCurve = allCards.reduce((acc: Record<string, number>, item) => {
    const cmc = Math.min(item.card.mana_value || 0, 7)
    const key = cmc === 7 ? '7+' : cmc.toString()
    acc[key] = (acc[key] || 0) + item.quantity
    return acc
  }, {})

  return {
    cards: suggestions,
    total_cards: suggestions.reduce((sum: number, s) => sum + s.quantity, 0),
    strategy_analysis: generateStrategyAnalysis(strategy, analysis),
    mana_base_suggestion: manaBaseSuggestion,
    curve_analysis: finalCurve
  }
}

function getStrategySupportCategories(strategy: BuildStrategy, analysis: any) {
  const baseCategories = [
    {
      name: 'removal',
      max_cards: strategy.interaction_level === 'heavy' ? 12 : 
                 strategy.interaction_level === 'moderate' ? 8 : 4,
      preferred_quantity: 2,
      filter: (card: Card) => {
        const text = (card.oracle_text || '').toLowerCase()
        return text.includes('destroy') || text.includes('exile') || 
               text.includes('damage') || text.includes('counter')
      },
      reasoning: 'Interazione necessaria per gestire minacce avversarie'
    }
  ]

  // Add strategy-specific categories
  switch (strategy.strategy_type) {
    case 'aggro':
      baseCategories.push({
        name: 'aggressive_creatures',
        max_cards: 16,
        preferred_quantity: 4,
        filter: (card: Card) => {
          const isCreature = (card.types || []).includes('Creature')
          const lowCost = (card.mana_value || 0) <= 3
          const hasHaste = (card.oracle_text || '').includes('haste')
          const highPower = card.power ? parseInt(card.power) >= 2 : false
          return isCreature && lowCost && (hasHaste || highPower)
        },
        reasoning: 'Creature aggressive per pressione immediata'
      })
      break

    case 'ramp':
      baseCategories.push({
        name: 'ramp_spells',
        max_cards: 8,
        preferred_quantity: 3,
        filter: (card: Card) => {
          const text = (card.oracle_text || '').toLowerCase()
          return (text.includes('add') && text.includes('mana')) || 
                 (text.includes('search') && text.includes('land'))
        },
        reasoning: 'Accelerazione mana per giocate potenti'
      })
      break
  }

  return baseCategories
}

function generateManaBase(colors: string[], format: string, targetCards: number): Card[] {
  const basicLands: Record<string, Card> = {
    'W': {
      id: 'plains', name: 'Plains', mana_cost: '', mana_value: 0,
      colors: [], color_identity: [], types: ['Basic', 'Land'],
      oracle_text: '{T}: Add {W}.', power: null, toughness: null,
      rarity: 'common', set_code: 'UNF', image_url: null
    },
    'U': {
      id: 'island', name: 'Island', mana_cost: '', mana_value: 0,
      colors: [], color_identity: [], types: ['Basic', 'Land'],
      oracle_text: '{T}: Add {U}.', power: null, toughness: null,
      rarity: 'common', set_code: 'UNF', image_url: null
    },
    'B': {
      id: 'swamp', name: 'Swamp', mana_cost: '', mana_value: 0,
      colors: [], color_identity: [], types: ['Basic', 'Land'],
      oracle_text: '{T}: Add {B}.', power: null, toughness: null,
      rarity: 'common', set_code: 'UNF', image_url: null
    },
    'R': {
      id: 'mountain', name: 'Mountain', mana_cost: '', mana_value: 0,
      colors: [], color_identity: [], types: ['Basic', 'Land'],
      oracle_text: '{T}: Add {R}.', power: null, toughness: null,
      rarity: 'common', set_code: 'UNF', image_url: null
    },
    'G': {
      id: 'forest', name: 'Forest', mana_cost: '', mana_value: 0,
      colors: [], color_identity: [], types: ['Basic', 'Land'],
      oracle_text: '{T}: Add {G}.', power: null, toughness: null,
      rarity: 'common', set_code: 'UNF', image_url: null
    }
  }

  return colors.map((color: string) => basicLands[color]).filter(Boolean)
}

function generateStrategyAnalysis(strategy: BuildStrategy, analysis: any): string {
  return `Strategia ${strategy.strategy_type}: Focus su ${strategy.focus_areas.join(', ')}. ` +
         `Curve ${strategy.mana_curve_preference}, interazione ${strategy.interaction_level}. ` +
         `Colori dominanti: ${analysis.dominant_colors.join(', ')}.`
}