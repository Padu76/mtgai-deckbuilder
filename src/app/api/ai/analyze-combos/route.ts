// src/app/api/ai/analyze-combos/route.ts
// FIXED: Prima interroga tabella combos esistenti, poi genera con AI
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

interface ExistingCombo {
  id: string
  name: string
  result_tag: string
  steps: string
  color_identity: string[]
  source: string
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

    // STEP 1: Cerca combo esistenti nella tabella combos
    console.log('Searching existing combos in database...')
    const existingCombos = await getExistingCombos(supabase, colors, format)
    console.log(`Found ${existingCombos.length} existing combos matching colors ${colors.join(', ')}`)

    // STEP 2: Se abbiamo abbastanza combo esistenti, ritorna quelle
    if (existingCombos.length >= max_combos) {
      return NextResponse.json({
        ok: true,
        combos: existingCombos.slice(0, max_combos),
        categories: categorizeExistingCombos(existingCombos),
        total_existing_combos: existingCombos.length,
        colors_requested: colors,
        format,
        source: 'database_only'
      })
    }

    // STEP 3: Se servono più combo, genera con AI
    console.log(`Need more combos. Generating additional ${max_combos - existingCombos.length} with AI...`)
    
    // Get cards with format filtering per AI generation
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
      // Se non ci sono carte ma abbiamo combo esistenti, ritorna quelle
      if (existingCombos.length > 0) {
        return NextResponse.json({
          ok: true,
          combos: existingCombos,
          categories: categorizeExistingCombos(existingCombos),
          total_existing_combos: existingCombos.length,
          colors_requested: colors,
          format,
          source: 'database_only'
        })
      }
      
      return NextResponse.json({ 
        error: 'No cards found in database for this format',
        ok: false 
      }, { status: 404 })
    }

    // Filter cards for AI generation
    const validCards = cards.filter(card => {
      try {
        if (!card.name || typeof card.name !== 'string') return false
        if (!card.oracle_text || typeof card.oracle_text !== 'string') return false
        if (!Array.isArray(card.color_identity)) return false
        if (!Array.isArray(card.types)) return false
        
        const cardColors = card.color_identity || []
        
        // Colorless cards are always allowed
        if (cardColors.length === 0) return true
        
        // Card must have ONLY colors that are in our selected colors
        return cardColors.every((color: string) => colors.includes(color))
      } catch (e) {
        console.warn(`Card validation error for card ${card.id}:`, e)
        return false
      }
    })

    console.log(`Filtered to ${validCards.length} valid cards matching colors ${colors.join(', ')}`)

    // Generate additional combos with AI
    const aiCombos = await analyzeWithPatterns(validCards, colors, format, max_combos - existingCombos.length)

    // STEP 4: Combina risultati esistenti + AI
    const allCombos = [
      ...existingCombos,
      ...aiCombos
    ].slice(0, max_combos)

    console.log(`Returning ${allCombos.length} total combos (${existingCombos.length} from database, ${aiCombos.length} from AI)`)

    return NextResponse.json({
      ok: true,
      combos: allCombos,
      categories: categorizeAllCombos(allCombos),
      total_existing_combos: existingCombos.length,
      total_ai_combos: aiCombos.length,
      colors_requested: colors,
      format,
      source: 'database_and_ai'
    })

  } catch (error: any) {
    console.error('Error with combo analysis:', error)
    return NextResponse.json({ 
      error: 'Analysis failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

// NUOVA FUNZIONE: Cerca combo esistenti nel database
async function getExistingCombos(supabase: any, colors: string[], format: string): Promise<any[]> {
  try {
    // Costruisci query per color identity
    let query = supabase
      .from('combos')
      .select('*')
    
    // Filtra per color identity - le combo devono avere SOLO i colori selezionati o subset
    if (colors.length === 1) {
      // Un solo colore: cerca combo con quel colore o incolori
      query = query.or(`color_identity.cs.{}, color_identity.cs.{${colors[0]}}, color_identity.ov.{${colors[0]}}`)
    } else if (colors.length === 2) {
      // Due colori: costruisci query per tutte le combinazioni
      const [color1, color2] = colors
      query = query.or([
        `color_identity.cs.{}`, // Incolori
        `color_identity.cs.{${color1}}`, // Solo primo colore
        `color_identity.cs.{${color2}}`, // Solo secondo colore  
        `color_identity.cs.{${color1},${color2}}`, // Entrambi i colori
        `color_identity.cs.{${color2},${color1}}` // Entrambi i colori (ordine opposto)
      ].join(','))
    } else {
      // Tre o più colori: query più complessa - per ora accetta tutte le combo che hanno subset dei colori
      // Questo è un workaround - per una soluzione completa servirebbe una query più sofisticata
      console.log('Multi-color query (3+ colors) - using broad match')
    }

    const { data: combos, error } = await query.limit(50)
    
    if (error) {
      console.error('Error fetching existing combos:', error)
      return []
    }

    if (!combos || combos.length === 0) {
      return []
    }

    // Post-filter in JavaScript per color identity precisa (fallback per query PostgreSQL complesse)
    const filteredCombos = combos.filter((combo: any) => {
      const comboColors = combo.color_identity || []
      
      // Incolori sono sempre OK
      if (comboColors.length === 0) return true
      
      // La combo deve avere SOLO colori che sono nei nostri colori selezionati
      return comboColors.every((color: string) => colors.includes(color))
    })

    // Converti format database in format UI
    return filteredCombos.map((combo: any) => ({
      id: combo.id,
      cards: [], // Le combo del database non hanno carte associate, solo nomi
      category: inferCategoryFromCombo(combo),
      type: inferTypeFromCombo(combo),
      description: combo.result_tag || combo.name,
      steps: combo.steps ? combo.steps.split('.').map((s: string) => s.trim()).filter((s: string) => s) : [combo.name],
      reliability: 'high', // Le combo del database sono validate
      setup_turns: inferSetupTurns(combo),
      mana_cost_total: 0, // Non disponibile nel database
      power_level: inferPowerLevel(combo),
      name: combo.name,
      result_tag: combo.result_tag,
      color_identity: combo.color_identity,
      source: combo.source || 'database'
    }))

  } catch (error) {
    console.error('Error in getExistingCombos:', error)
    return []
  }
}

// Helper functions per inferire dati dalle combo esistenti
function inferCategoryFromCombo(combo: any): string {
  const name = combo.name?.toLowerCase() || ''
  const tag = combo.result_tag?.toLowerCase() || ''
  const steps = combo.steps?.toLowerCase() || ''
  
  if (name.includes('infinite') || tag.includes('infinite') || steps.includes('infinite')) {
    if (name.includes('damage') || tag.includes('damage')) return 'infinite_damage'
    if (name.includes('mana') || tag.includes('mana')) return 'infinite_mana'
    if (name.includes('token') || name.includes('creature')) return 'infinite_tokens'
    return 'infinite'
  }
  
  if (name.includes('mill') || tag.includes('mill')) return 'mill'
  if (name.includes('poison') || name.includes('toxic')) return 'poison'
  if (name.includes('engine') || tag.includes('engine')) return 'value_engine'
  
  return 'synergy'
}

function inferTypeFromCombo(combo: any): 'infinite' | 'synergy' | 'win_condition' | 'value_engine' {
  const category = inferCategoryFromCombo(combo)
  if (category.includes('infinite')) return 'infinite'
  if (category === 'value_engine') return 'value_engine'
  if (combo.result_tag?.toLowerCase().includes('win')) return 'win_condition'
  return 'synergy'
}

function inferSetupTurns(combo: any): number {
  // Stima basata sul nome della combo
  const name = combo.name?.toLowerCase() || ''
  if (name.includes('turn 1') || name.includes('t1')) return 1
  if (name.includes('turn 2') || name.includes('t2')) return 2
  if (name.includes('fast') || name.includes('quick')) return 2
  if (name.includes('slow') || name.includes('late')) return 5
  return 3 // Default ragionevole
}

function inferPowerLevel(combo: any): number {
  const name = combo.name?.toLowerCase() || ''
  const tag = combo.result_tag?.toLowerCase() || ''
  
  if (name.includes('infinite') || tag.includes('infinite')) return 9
  if (name.includes('win') || tag.includes('win')) return 8
  if (name.includes('engine') || tag.includes('engine')) return 6
  if (combo.source === 'arena_curated') return 7 // Combo curate sono forti
  return 5
}

function categorizeExistingCombos(combos: any[]) {
  return combos.reduce((acc: any, combo) => {
    const category = combo.category || 'unknown'
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {})
}

function categorizeAllCombos(combos: any[]) {
  return combos.reduce((acc: any, combo) => {
    const category = combo.category || 'unknown'
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {})
}

// RESTO DEL CODICE AI (invariato ma con limit parameter)
async function analyzeWithPatterns(cards: Card[], colors: string[], format: string, maxResults: number = 10): Promise<ComboPattern[]> {
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
    if (combos.length >= maxResults) break
    
    try {
      const matchingCards = cards.filter(card => {
        if (!card.oracle_text) return false
        const text = card.oracle_text.toLowerCase()
        
        // Must match at least one keyword
        const hasKeyword = pattern.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        )
        
        if (!hasKeyword) return false
        
        // Ensure card colors strictly match our selection
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
        // Process cards with proper validation
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

  return combos.slice(0, maxResults)
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