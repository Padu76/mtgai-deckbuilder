// src/app/api/ai/analyze-combos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

export const dynamic = 'force-dynamic'

interface Card {
  id: string
  name: string
  mana_cost: string
  mana_value: number
  colors: string[]
  color_identity: string[]
  types: string[]
  oracle_text: string
  rarity: string
}

interface ComboSuggestion {
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

const COMBO_CATEGORIES = {
  'instant_win': 'Vittoria Istantanea',
  'infinite_tokens': 'Pedine Infinite',
  'infinite_damage': 'Danno Infinito', 
  'infinite_mana': 'Mana Infinito',
  'infinite_mill': 'Mill Infinito',
  'poison': 'Veleno (Poison/Toxic)',
  'life_drain': 'Prosciugamento Vita',
  'draw_damage': 'Danni da Pescaggio',
  'lock_stax': 'Lock/Controllo',
  'value_engine': 'Motore di Valore',
  'graveyard': 'Ricorsione/Graveyard',
  'sacrifice': 'Sinergie Sacrificio'
}

// Analizza le carte con AI per trovare sinergie
async function analyzeCardSynergies(cards: Card[]): Promise<any[]> {
  const prompt = `
Analizza queste carte Magic The Gathering e identifica TUTTE le possibili combo e sinergie:

CARTE DISPONIBILI:
${cards.map(card => `
- ${card.name} (${card.mana_cost}) 
  Tipi: ${card.types.join(', ')}
  Testo: ${card.oracle_text}
`).join('\n')}

IDENTIFICA:
1. Combo infinite (mana, pedine, danno, mill)
2. Win condition immediate
3. Sinergie poison/toxic 
4. Danni da pescaggio/deck out
5. Lock permanenti
6. Value engine forti
7. Ricorsioni graveyard
8. Sacrifice synergies

Per ogni combo/sinergia trovata, rispondi in questo formato JSON:
{
  "combos": [
    {
      "cards": ["Nome Carta 1", "Nome Carta 2", "Nome Carta 3"],
      "category": "infinite_tokens|infinite_damage|instant_win|poison|draw_damage|lock_stax|value_engine|graveyard|sacrifice",
      "type": "infinite|synergy|win_condition|value_engine",
      "description": "Breve descrizione del risultato",
      "steps": ["Passo 1", "Passo 2", "Passo 3"],
      "reliability": "high|medium|low",
      "setup_turns": numero_turni_per_setup,
      "mana_cost_total": costo_mana_totale,
      "power_level": 1-10
    }
  ]
}

Cerca anche sinergie sottili e interazioni non ovvie. Includi combo che richiedono 2-4 carte max.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    })

    const data = await response.json()
    const aiResponse = data.content[0].text

    // Estrai il JSON dalla risposta AI
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]).combos || []
    }
  } catch (error) {
    console.error('Error with AI analysis:', error)
  }

  return []
}

// Identifica pattern combo con regole euristiche
function findComboPatterns(cards: Card[]): ComboSuggestion[] {
  const combos: ComboSuggestion[] = []
  
  // Pattern: Infinite Tokens
  const tokenMakers = cards.filter(c => 
    c.oracle_text.toLowerCase().includes('create') && 
    c.oracle_text.toLowerCase().includes('token')
  )
  const flickerCards = cards.filter(c =>
    c.oracle_text.toLowerCase().includes('exile') && 
    c.oracle_text.toLowerCase().includes('return')
  )
  
  tokenMakers.forEach(maker => {
    flickerCards.forEach(flicker => {
      if (maker.id !== flicker.id) {
        combos.push({
          id: `${maker.id}-${flicker.id}`,
          cards: [maker, flicker],
          category: 'infinite_tokens',
          type: 'infinite',
          description: `${maker.name} + ${flicker.name} per pedine infinite`,
          steps: [
            `Gioca ${maker.name}`,
            `Usa ${flicker.name} per esiliare e far rientrare ${maker.name}`,
            `Ogni rientro crea nuove pedine`
          ],
          reliability: 'medium',
          setup_turns: 3,
          mana_cost_total: maker.mana_value + flicker.mana_value,
          power_level: 7
        })
      }
    })
  })

  // Pattern: Poison
  const poisonCards = cards.filter(c => 
    c.oracle_text.toLowerCase().includes('poison') ||
    c.oracle_text.toLowerCase().includes('toxic')
  )
  const proliferateCards = cards.filter(c =>
    c.oracle_text.toLowerCase().includes('proliferate')
  )
  
  if (poisonCards.length > 0 && proliferateCards.length > 0) {
    combos.push({
      id: 'poison-proliferate',
      cards: [...poisonCards.slice(0, 2), ...proliferateCards.slice(0, 1)],
      category: 'poison',
      type: 'synergy',
      description: 'Combo poison con proliferate per vittoria rapida',
      steps: [
        'Infliggi segnalini poison',
        'Usa proliferate per raddoppiarli',
        'Raggiungi 10 poison per vincere'
      ],
      reliability: 'high',
      setup_turns: 4,
      mana_cost_total: poisonCards[0]?.mana_value + proliferateCards[0]?.mana_value,
      power_level: 8
    })
  }

  // Pattern: Mill + Damage
  const millCards = cards.filter(c =>
    c.oracle_text.toLowerCase().includes('mill') ||
    c.oracle_text.toLowerCase().includes('library') && c.oracle_text.toLowerCase().includes('graveyard')
  )
  const drawPunishers = cards.filter(c =>
    c.oracle_text.toLowerCase().includes('whenever') && 
    c.oracle_text.toLowerCase().includes('draw') &&
    c.oracle_text.toLowerCase().includes('damage')
  )

  millCards.forEach(mill => {
    drawPunishers.forEach(punisher => {
      combos.push({
        id: `${mill.id}-${punisher.id}`,
        cards: [mill, punisher],
        category: 'draw_damage',
        type: 'synergy',
        description: `Mill + danni da pescaggio`,
        steps: [
          `Gioca ${punisher.name}`,
          `Usa ${mill.name} per far pescare/millare l'avversario`,
          `Ogni carta pescata/millata infligge danno`
        ],
        reliability: 'medium',
        setup_turns: 3,
        mana_cost_total: mill.mana_value + punisher.mana_value,
        power_level: 6
      })
    })
  })

  return combos
}

export async function POST(req: NextRequest) {
  try {
    const { colors, format = 'historic', max_combos = 20 } = await req.json()

    if (!colors || colors.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Colors required' 
      }, { status: 400 })
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { 
      auth: { persistSession: false } 
    })

    // Fetch cards matching colors and format
    let query = supa
      .from('cards')
      .select('*')
      .eq('in_arena', true)
      .overlaps('color_identity', colors)
      .limit(500) // Limit per non sovraccaricare l'AI

    if (format === 'standard') {
      query = query.eq('legal_standard', true)
    } else if (format === 'historic') {
      query = query.eq('legal_historic', true)
    } else if (format === 'brawl') {
      query = query.eq('legal_brawl', true)
    }

    const { data: cards, error } = await query

    if (error) {
      return NextResponse.json({ 
        ok: false, 
        error: error.message 
      }, { status: 500 })
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No cards found for selected colors' 
      }, { status: 404 })
    }

    console.log(`Analyzing ${cards.length} cards for combo potential...`)

    // Combina analisi AI + pattern recognition
    const aiCombos = await analyzeCardSynergies(cards.slice(0, 100)) // Primi 100 per AI
    const patternCombos = findComboPatterns(cards)
    
    // Merge e deduplica
    const allCombos = [...aiCombos, ...patternCombos]
    const uniqueCombos = allCombos
      .filter(combo => combo.cards && combo.cards.length >= 2)
      .slice(0, max_combos)
      .sort((a, b) => (b.power_level || 0) - (a.power_level || 0))

    // Map card names back to full card objects
    const processedCombos = uniqueCombos.map(combo => ({
      ...combo,
      cards: combo.cards.map(cardName => 
        cards.find(c => c.name === cardName) || { name: cardName }
      ).filter(Boolean)
    })).filter(combo => combo.cards.length >= 2)

    return NextResponse.json({
      ok: true,
      combos: processedCombos,
      total_cards_analyzed: cards.length,
      categories: COMBO_CATEGORIES
    })

  } catch (error: any) {
    console.error('Combo analysis error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: String(error) 
    }, { status: 500 })
  }
}