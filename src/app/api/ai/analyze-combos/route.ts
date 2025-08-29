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

    // Get cards with format filtering
    let query = supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)

    // Add format filtering
    if (format === 'standard') {
      query = query.eq('legal_standard', true)
    } else if (format === 'historic' || format === 'brawl') {
      query = query.eq('legal_historic', true)
    }

    const { data: cards, error } = await query.limit(2000)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        error: 'Database error: ' + error.message,
        ok: false 
      }, { status: 500 })
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ 
        error: 'No cards found in database for this format',
        ok: false 
      }, { status: 404 })
    }

    console.log(`Found ${cards.length} cards in ${format} format`)

    // FIXED: Strict color filtering - only cards that have EXACTLY the selected colors or subset
    const validCards = cards.filter(card => {
      try {
        // Ensure required fields exist and are valid
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        if (!Array.isArray(card.color_identity)) return false
        if (!Array.isArray(card.types)) return false
        
        // FIXED: Strict color identity matching
        const cardColors = card.color_identity || []
        
        // Colorless cards (no color identity) are always allowed
        if (cardColors.length === 0) return true
        
        // Card must have ONLY colors that are in our selected colors
        return cardColors.every((color: string) => colors.includes(color))
      } catch (e) {
        console.warn(`Card validation error for card ${card.id}:`, e)
        return false
      }
    })

    console.log(`Filtered to ${validCards.length} valid cards matching colors ${colors.join(', ')}`)

    // Generate combos using pattern matching
    const combos = await analyzeWithPatterns(validCards, colors, format)

    // Limit results
    const finalCombos = combos.slice(0, max_combos)

    console.log(`Found ${finalCombos.length} combo suggestions`)

    // Safe categorization
    const categories = finalCombos.reduce((acc: any, combo) => {
      const category = combo.category || 'unknown'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      ok: true,
      combos: finalCombos,
      categories,
      total_cards_analyzed: validCards.length,
      colors_requested: colors,
      format
    })

  } catch (error: any) {
    console.error('Error with combo analysis:', error)
    return NextResponse.json({ 
      error: 'Analysis failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

async function analyzeWithPatterns(cards: Card[], colors: string[], format: string): Promise<ComboPattern[]> {
  const combos: ComboPattern[] = []
  
  // Enhanced combo patterns for better detection
  const patterns = [
    {
      id: 'poison_proliferate',
      category: 'poison',
      keywords: ['poison', 'toxic', 'proliferate'],
      description: 'Combo Veleno + Proliferate',
      power_level: 8,
      setup_turns: 3,
      priority: 1
    },
    {
      id: 'infinite_tokens',
      category: 'infinite_tokens', 
      keywords: ['create', 'token', 'copy', 'populate', 'double'],
      description: 'Generazione Infinita Pedine',
      power_level: 8,
      setup_turns: 4,
      priority: 1
    },
    {
      id: 'infinite_mana',
      category: 'infinite_mana',
      keywords: ['add', 'mana', 'untap', 'cost reduction'],
      description: 'Generazione Mana Infinito',
      power_level: 9,
      setup_turns: 3,
      priority: 1
    },
    {
      id: 'infinite_damage',
      category: 'infinite_damage',
      keywords: ['damage', 'ping', 'bolt', 'shock', 'untap'],
      description: 'Danno Infinito Diretto',
      power_level: 8,
      setup_turns: 4,
      priority: 1
    },
    {
      id: 'sacrifice_synergy',
      category: 'value_engine',
      keywords: ['sacrifice', 'death', 'enters', 'leaves', 'dies'],
      description: 'Engine Sacrifice/Death Trigger',
      power_level: 6,
      setup_turns: 3,
      priority: 2
    },
    {
      id: 'draw_mill',
      category: 'mill',
      keywords: ['mill', 'library', 'graveyard', 'cards into graveyard'],
      description: 'Mill + Punishment Engine',
      power_level: 6,
      setup_turns: 4,
      priority: 2
    },
    {
      id: 'flicker_etb',
      category: 'flicker',
      keywords: ['exile', 'return', 'enters the battlefield', 'flicker'],
      description: 'Flicker/ETB Value Engine',
      power_level: 6,
      setup_turns: 3,
      priority: 2
    },
    {
      id: 'ramp_big',
      category: 'ramp',
      keywords: ['search', 'land', 'mana', 'ramp'],
      description: 'Accelerazione Mana',
      power_level: 5,
      setup_turns: 2,
      priority: 3
    }
  ]

  // Find combos by pattern matching with strict color adherence
  for (const pattern of patterns) {
    try {
      const matchingCards = cards.filter(card => {
        if (!card.oracle_text) return false
        const text = card.oracle_text.toLowerCase()
        
        // Must match at least one keyword
        const hasKeyword = pattern.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        )
        
        if (!hasKeyword) return false
        
        // FIXED: Ensure card colors strictly match our selection
        const cardColors = card.color_identity || []
        return cardColors.length === 0 || cardColors.every(color => colors.includes(color))
      })
      
      // Sort by relevance and mana cost
      .sort((a, b) => {
        // First by keyword matches (more matches = higher relevance)
        const aMatches = pattern.keywords.filter(keyword => 
          (a.oracle_text || '').toLowerCase().includes(keyword.toLowerCase())
        ).length
        const bMatches = pattern.keywords.filter(keyword => 
          (b.oracle_text || '').toLowerCase().includes(keyword.toLowerCase())
        ).length
        
        if (aMatches !== bMatches) return bMatches - aMatches
        
        // Then by mana cost (lower is better for combos)
        return (a.mana_value || 0) - (b.mana_value || 0)
      })
      .slice(0, format === 'brawl' ? 4 : 3) // Limit cards per combo

      if (matchingCards.length >= 2) {
        // FIXED: Process cards with proper validation
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

        // Generate more specific steps based on pattern
        const steps = generateComboSteps(pattern, processedCards)

        combos.push({
          id: `${pattern.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          cards: processedCards,
          category: pattern.category,
          type: pattern.priority === 1 ? 'infinite' : 'synergy',
          description: pattern.description,
          steps: steps,
          reliability: totalManaCost <= 4 ? 'high' : totalManaCost <= 7 ? 'medium' : 'low',
          setup_turns: pattern.setup_turns,
          mana_cost_total: totalManaCost,
          power_level: Math.max(1, pattern.power_level - Math.floor(totalManaCost / 3))
        })
      }
    } catch (patternError) {
      console.warn(`Error processing pattern ${pattern.id}:`, patternError)
      continue
    }
  }

  // Sort combos by power level (highest first)
  combos.sort((a, b) => b.power_level - a.power_level)

  // Ensure minimum variety - if too few combos, generate basic synergies
  if (combos.length < 3) {
    const additionalCombos = generateBasicSynergies(cards, colors, format, 5 - combos.length)
    combos.push(...additionalCombos)
  }

  return combos
}

function generateComboSteps(pattern: any, cards: Card[]): string[] {
  const card1 = cards[0]?.name || 'Prima carta'
  const card2 = cards[1]?.name || 'Seconda carta'
  const card3 = cards[2]?.name || 'Terza carta'

  switch (pattern.category) {
    case 'poison':
      return [
        `Gioca ${card1} per iniziare a dare poison counter`,
        `Attiva ${card2} per proliferare i counter`,
        `Ripeti il processo fino a 10 poison counter per la vittoria`
      ]
    case 'infinite_tokens':
      return [
        `Metti in campo ${card1} per creare la prima pedina`,
        `Usa ${card2} per copiare/duplicare le pedine`,
        `Continua il loop per pedine infinite`
      ]
    case 'infinite_mana':
      return [
        `Gioca ${card1} per generare mana`,
        `Usa ${card2} per stappare e ripetere`,
        `Mana infinito disponibile per combo devastanti`
      ]
    case 'infinite_damage':
      return [
        `Metti ${card1} per la fonte di danno`,
        `Combina con ${card2} per ripetere infinite volte`,
        `Infliggi danno letale all'avversario`
      ]
    default:
      return [
        `Stabilisci ${card1} per la base della combo`,
        `Attiva ${card2} per il vantaggio`,
        `Sfrutta la sinergia per dominare il gioco`
      ]
  }
}

function generateBasicSynergies(cards: Card[], colors: string[], format: string, count: number): ComboPattern[] {
  const synergies: ComboPattern[] = []
  
  // Group cards by type for basic synergies
  const creatures = cards.filter(c => c.types?.includes('Creature') && c.mana_value && c.mana_value <= 6)
  const spells = cards.filter(c => c.types?.some(t => ['Instant', 'Sorcery'].includes(t)))
  
  if (creatures.length >= 2) {
    for (let i = 0; i < Math.min(count, 3); i++) {
      const selectedCards = creatures.slice(i * 2, i * 2 + 2)
      if (selectedCards.length === 2) {
        synergies.push({
          id: `basic_creature_synergy_${i}`,
          cards: selectedCards.map(card => ({
            id: card.id || '',
            name: card.name || '',
            mana_cost: card.mana_cost || '',
            mana_value: card.mana_value || 0,
            colors: card.colors || [],
            color_identity: card.color_identity || [],
            oracle_text: card.oracle_text || '',
            rarity: card.rarity || 'common',
            types: card.types || [],
            power: card.power,
            toughness: card.toughness,
            set_code: card.set_code,
            image_url: card.image_url
          })),
          category: 'creature_synergy',
          type: 'synergy',
          description: `Sinergia Creature ${colors.join('-')}`,
          steps: [
            `Gioca ${selectedCards[0].name} per pressione early game`,
            `Segui con ${selectedCards[1].name} per raddoppiare la minaccia`,
            `Mantieni pressione costante sull'avversario`
          ],
          reliability: 'medium',
          setup_turns: 3,
          mana_cost_total: selectedCards.reduce((sum, c) => sum + (c.mana_value || 0), 0),
          power_level: 5
        })
      }
    }
  }

  return synergies
}