// src/app/api/ai/find-combos-with-card/route.ts
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

interface ComboMatch {
  id: string
  description: string
  category: string
  cards: Card[]
  synergy_type: 'infinite' | 'engine' | 'protection' | 'acceleration' | 'win_condition'
  power_level: number
  reliability: 'high' | 'medium' | 'low'
  mana_cost_total: number
  explanation: string[]
  keywords_matched: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { card_name, card_id, format = 'historic', max_results = 15 } = body

    if (!card_name && !card_id) {
      return NextResponse.json({ 
        error: 'Card name or ID is required',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Finding combos for card: ${card_name || card_id}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get the target card first
    let targetCardQuery = supabase.from('cards').select('*')
    
    if (card_id) {
      targetCardQuery = targetCardQuery.eq('id', card_id)
    } else {
      targetCardQuery = targetCardQuery.ilike('name', `%${card_name}%`)
    }

    const { data: targetCards, error: targetError } = await targetCardQuery.limit(1)

    if (targetError || !targetCards || targetCards.length === 0) {
      return NextResponse.json({ 
        error: 'Card not found',
        ok: false 
      }, { status: 404 })
    }

    const targetCard = targetCards[0]
    console.log(`Target card found: ${targetCard.name}`)

    // Get all cards for combo analysis
    const { data: cardPool, error: poolError } = await supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)
      .limit(2000)

    if (poolError) {
      console.error('Database error:', poolError)
      return NextResponse.json({ 
        error: 'Database error: ' + poolError.message,
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
        if (card.id === targetCard.id) return false // Exclude the target card itself
        return true
      } catch (e) {
        return false
      }
    })

    console.log(`Analyzing ${validCards.length} cards for combos with ${targetCard.name}`)

    // Find combos
    const combos = await findCombosWithCard(targetCard, validCards, max_results)

    console.log(`Found ${combos.length} potential combos`)

    return NextResponse.json({
      ok: true,
      target_card: targetCard,
      combos,
      total_combinations_analyzed: validCards.length,
      format
    })

  } catch (error: any) {
    console.error('Error finding combos:', error)
    return NextResponse.json({ 
      error: 'Combo search failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

async function findCombosWithCard(
  targetCard: Card, 
  cardPool: Card[], 
  maxResults: number
): Promise<ComboMatch[]> {
  
  const combos: ComboMatch[] = []
  const targetText = (targetCard.oracle_text || '').toLowerCase()
  const targetTypes = targetCard.types || []
  const targetColors = targetCard.color_identity || []

  // Define synergy patterns
  const synergyPatterns = [
    {
      name: 'Infinite Mana',
      category: 'infinite_mana',
      power_level: 9,
      target_keywords: ['untap', 'add', 'mana'],
      partner_keywords: ['untap', 'cost reduction', 'free spell'],
      synergy_type: 'infinite' as const,
      explanation: 'Genera mana infinito attraverso loop di untap'
    },
    {
      name: 'Infinite Tokens',
      category: 'infinite_tokens', 
      power_level: 8,
      target_keywords: ['create', 'token', 'copy'],
      partner_keywords: ['create', 'populate', 'double', 'copy'],
      synergy_type: 'infinite' as const,
      explanation: 'Crea pedine infinite attraverso loop di copia'
    },
    {
      name: 'Sacrifice Engine',
      category: 'sacrifice_engine',
      power_level: 7,
      target_keywords: ['sacrifice', 'death', 'dies'],
      partner_keywords: ['death', 'sacrifice', 'enters', 'create'],
      synergy_type: 'engine' as const,
      explanation: 'Engine di valore attraverso sacrifici ripetuti'
    },
    {
      name: 'Proliferate Combo',
      category: 'proliferate',
      power_level: 7,
      target_keywords: ['counter', 'charge', '+1/+1', 'loyalty'],
      partner_keywords: ['proliferate', 'counter', 'double'],
      synergy_type: 'engine' as const,
      explanation: 'Accelera counter attraverso proliferate'
    },
    {
      name: 'Mill Engine',
      category: 'mill',
      power_level: 6,
      target_keywords: ['mill', 'library', 'graveyard'],
      partner_keywords: ['mill', 'graveyard', 'exile', 'library'],
      synergy_type: 'win_condition' as const,
      explanation: 'Svuota libreria avversario per victory'
    },
    {
      name: 'Ramp Acceleration',
      category: 'ramp',
      power_level: 6,
      target_keywords: ['land', 'mana', 'search'],
      partner_keywords: ['land', 'ramp', 'search', 'extra'],
      synergy_type: 'acceleration' as const,
      explanation: 'Accelera sviluppo mana per gioco veloce'
    },
    {
      name: 'Protection Suite',
      category: 'protection',
      power_level: 5,
      target_keywords: ['indestructible', 'hexproof', 'protection'],
      partner_keywords: ['protection', 'indestructible', 'hexproof', 'ward'],
      synergy_type: 'protection' as const,
      explanation: 'Protegge assets chiave da removal'
    },
    {
      name: 'Draw Engine',
      category: 'card_advantage',
      power_level: 6,
      target_keywords: ['draw', 'card', 'hand'],
      partner_keywords: ['draw', 'card', 'refill', 'library'],
      synergy_type: 'engine' as const,
      explanation: 'Genera vantaggio carte per long game'
    },
    {
      name: 'Flicker/Blink',
      category: 'flicker',
      power_level: 6,
      target_keywords: ['enters', 'etb', 'when', 'battlefield'],
      partner_keywords: ['exile', 'return', 'flicker', 'blink'],
      synergy_type: 'engine' as const,
      explanation: 'Riusa effetti ETB per valore ripetuto'
    },
    {
      name: 'Poison/Toxic',
      category: 'poison',
      power_level: 8,
      target_keywords: ['poison', 'toxic', 'infect'],
      partner_keywords: ['poison', 'toxic', 'proliferate', 'counter'],
      synergy_type: 'win_condition' as const,
      explanation: 'Victory attraverso poison counter'
    }
  ]

  // Check each synergy pattern
  for (const pattern of synergyPatterns) {
    // Check if target card matches this pattern
    const targetMatches = pattern.target_keywords.some(keyword => 
      targetText.includes(keyword.toLowerCase())
    )
    
    if (!targetMatches) continue

    // Find partner cards for this pattern
    const partnerCards = cardPool
      .filter((card: Card) => {
        try {
          const cardText = (card.oracle_text || '').toLowerCase()
          
          // Must match partner keywords
          const hasPartnerKeywords = pattern.partner_keywords.some(keyword =>
            cardText.includes(keyword.toLowerCase())
          )
          
          if (!hasPartnerKeywords) return false

          // Color identity compatibility (allow colorless)
          const cardColors = card.color_identity || []
          if (cardColors.length > 0 && targetColors.length > 0) {
            const hasColorOverlap = cardColors.some(color => targetColors.includes(color)) ||
                                  targetColors.some(color => cardColors.includes(color))
            if (!hasColorOverlap) return false
          }

          // Reasonable mana cost
          const cardCost = card.mana_value || 0
          const targetCost = targetCard.mana_value || 0
          return (cardCost + targetCost) <= 12 // Reasonable total cost

        } catch (e) {
          return false
        }
      })
      .sort((a: Card, b: Card) => {
        // Prefer cards with better synergy
        const aText = (a.oracle_text || '').toLowerCase()
        const bText = (b.oracle_text || '').toLowerCase()
        
        const aMatches = pattern.partner_keywords.reduce((count, keyword) => 
          count + (aText.includes(keyword.toLowerCase()) ? 1 : 0), 0
        )
        const bMatches = pattern.partner_keywords.reduce((count, keyword) => 
          count + (bText.includes(keyword.toLowerCase()) ? 1 : 0), 0
        )
        
        if (aMatches !== bMatches) return bMatches - aMatches
        
        // Then by mana cost (prefer lower)
        return (a.mana_value || 0) - (b.mana_value || 0)
      })
      .slice(0, 5) // Top 5 partners for this pattern

    // Create combos
    partnerCards.forEach((partner, index) => {
      if (combos.length >= maxResults) return

      const matchedKeywords = [
        ...pattern.target_keywords.filter(k => targetText.includes(k.toLowerCase())),
        ...pattern.partner_keywords.filter(k => (partner.oracle_text || '').toLowerCase().includes(k.toLowerCase()))
      ]

      const reliability = getReliability(targetCard, partner, pattern)
      const totalCost = (targetCard.mana_value || 0) + (partner.mana_value || 0)

      combos.push({
        id: `${targetCard.id}_${partner.id}_${pattern.category}`,
        description: `${pattern.name} con ${partner.name}`,
        category: pattern.category,
        cards: [targetCard, partner],
        synergy_type: pattern.synergy_type,
        power_level: Math.max(1, pattern.power_level - index), // Slight decrease for lower priority partners
        reliability,
        mana_cost_total: totalCost,
        explanation: generateComboExplanation(targetCard, partner, pattern),
        keywords_matched: matchedKeywords
      })
    })
  }

  // Also look for type-based synergies
  const typeBasedCombos = findTypeBasedSynergies(targetCard, cardPool, maxResults - combos.length)
  combos.push(...typeBasedCombos)

  // Sort by power level and return top results
  return combos
    .sort((a, b) => b.power_level - a.power_level)
    .slice(0, maxResults)
}

function findTypeBasedSynergies(targetCard: Card, cardPool: Card[], maxResults: number): ComboMatch[] {
  const combos: ComboMatch[] = []
  const targetTypes = targetCard.types || []
  const targetColors = targetCard.color_identity || []

  // Type-based synergies
  const typeSynergies = [
    {
      targetType: 'Artifact',
      partnerKeywords: ['artifact', 'metalcraft', 'affinity'],
      category: 'artifact_synergy',
      description: 'Sinergia Artefatti',
      power_level: 6
    },
    {
      targetType: 'Enchantment', 
      partnerKeywords: ['enchantment', 'constellation', 'aura'],
      category: 'enchantment_synergy',
      description: 'Sinergia Incantesimi',
      power_level: 6
    },
    {
      targetType: 'Creature',
      partnerKeywords: ['creature', 'tribal', 'lord'],
      category: 'tribal_synergy', 
      description: 'Sinergia Tribale',
      power_level: 5
    }
  ]

  for (const synergy of typeSynergies) {
    if (!targetTypes.includes(synergy.targetType)) continue

    const partners = cardPool
      .filter((card: Card) => {
        const text = (card.oracle_text || '').toLowerCase()
        return synergy.partnerKeywords.some(keyword => text.includes(keyword))
      })
      .sort((a, b) => (a.mana_value || 0) - (b.mana_value || 0))
      .slice(0, 2)

    partners.forEach((partner) => {
      if (combos.length >= maxResults) return

      combos.push({
        id: `${targetCard.id}_${partner.id}_${synergy.category}`,
        description: `${synergy.description} con ${partner.name}`,
        category: synergy.category,
        cards: [targetCard, partner],
        synergy_type: 'engine',
        power_level: synergy.power_level,
        reliability: 'medium',
        mana_cost_total: (targetCard.mana_value || 0) + (partner.mana_value || 0),
        explanation: [
          `${targetCard.name} si sinergizza con ${partner.name}`,
          `Entrambe le carte condividono il tipo ${synergy.targetType}`,
          `Maggiore efficacia quando giocate insieme`
        ],
        keywords_matched: [synergy.targetType.toLowerCase()]
      })
    })
  }

  return combos
}

function getReliability(card1: Card, card2: Card, pattern: any): 'high' | 'medium' | 'low' {
  const totalCost = (card1.mana_value || 0) + (card2.mana_value || 0)
  
  if (totalCost <= 4) return 'high'
  if (totalCost <= 7) return 'medium'
  return 'low'
}

function generateComboExplanation(targetCard: Card, partnerCard: Card, pattern: any): string[] {
  return [
    `${targetCard.name} fornisce la base per ${pattern.explanation}`,
    `${partnerCard.name} completa la sinergia`,
    `Insieme creano un engine potente per il vantaggio`,
    `Combo category: ${pattern.category}`
  ]
}