// src/app/api/ai/find-combos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

export const dynamic = 'force-dynamic'

interface ComboSuggestion {
  id: string
  cards: string[]
  category: string
  type: 'infinite' | 'synergy' | 'win_condition' | 'value_engine'
  description: string
  steps: string[]
  reliability: 'high' | 'medium' | 'low'
  setup_turns: number
  mana_cost_total: number
  power_level: number
  colors?: string[]
  format_legal?: string[]
  source: 'database' | 'ai_generated'
}

interface ComboFilters {
  colors?: string[]
  power_level_min?: number
  power_level_max?: number
  max_setup_turns?: number
  max_cards?: number
  reliability?: string[]
  format?: string
  creative_mode?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      colors = [],
      power_level_min = 1,
      power_level_max = 10,
      max_setup_turns = 10,
      max_cards = 6,
      reliability = ['high', 'medium', 'low'],
      format = 'standard',
      creative_mode = false
    }: ComboFilters = body

    console.log(`Searching combos: colors=${colors.join(',')}, power=${power_level_min}-${power_level_max}, format=${format}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Step 1: Cerca nel database esistente
    console.log('Step 1: Searching database...')
    const databaseCombos = await searchDatabaseCombos(supabase, {
      colors,
      power_level_min,
      power_level_max,
      max_setup_turns,
      max_cards,
      reliability,
      format
    })

    console.log(`Found ${databaseCombos.length} combos in database`)

    // Step 2: Se pochi risultati, genera con AI
    let aiCombos: ComboSuggestion[] = []
    const shouldUseAI = databaseCombos.length < 5 || creative_mode

    if (shouldUseAI) {
      console.log('Step 2: Generating AI combos...')
      aiCombos = await generateAICombos(supabase, {
        colors,
        power_level_min,
        power_level_max, 
        max_setup_turns,
        max_cards,
        format,
        exclude_existing: databaseCombos.map(c => c.cards)
      })
      console.log(`Generated ${aiCombos.length} new AI combos`)
    }

    // Step 3: Combina risultati
    const allCombos = [...databaseCombos, ...aiCombos]
    
    // Step 4: Ordina per rilevanza
    const sortedCombos = allCombos.sort((a, b) => {
      // Priorità: database > AI, poi power level
      if (a.source === 'database' && b.source === 'ai_generated') return -1
      if (a.source === 'ai_generated' && b.source === 'database') return 1
      return b.power_level - a.power_level
    })

    const response = {
      ok: true,
      combos: sortedCombos.slice(0, 20), // Max 20 risultati
      total_found: allCombos.length,
      stats: {
        from_database: databaseCombos.length,
        from_ai: aiCombos.length,
        creative_mode_used: creative_mode || shouldUseAI
      },
      filters_applied: {
        colors: colors.length > 0 ? colors : undefined,
        power_range: [power_level_min, power_level_max],
        max_setup_turns,
        max_cards,
        reliability,
        format
      },
      categories: generateCategoryStats(allCombos)
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Hybrid combo search error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Combo search failed: ' + error.message,
      fallback_available: true
    }, { status: 500 })
  }
}

async function searchDatabaseCombos(supabase: any, filters: ComboFilters): Promise<ComboSuggestion[]> {
  try {
    let query = supabase
      .from('combos')
      .select('*')
      .gte('power_level', filters.power_level_min || 1)
      .lte('power_level', filters.power_level_max || 10)
      .lte('setup_turns', filters.max_setup_turns || 10)

    // Filtro colori
    if (filters.colors && filters.colors.length > 0) {
      // Cerca combo che contengono ALMENO uno dei colori richiesti
      const colorConditions = filters.colors.map(color => `colors.cs.{${color}}`).join(',')
      query = query.or(colorConditions)
    }

    // Filtro reliability
    if (filters.reliability && filters.reliability.length > 0) {
      query = query.in('reliability', filters.reliability)
    }

    // Filtro formato
    if (filters.format) {
      query = query.contains('format_legal', [filters.format])
    }

    // Filtro numero massimo carte
    if (filters.max_cards) {
      // PostgreSQL: array_length(cards, 1) <= max_cards
      query = query.lte('array_length(cards, 1)', filters.max_cards)
    }

    const { data, error } = await query
      .order('power_level', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Database query error:', error)
      return []
    }

    // Converti al formato ComboSuggestion
    return (data || []).map((combo: any) => ({
      id: combo.id,
      cards: combo.cards || [],
      category: combo.category || 'synergy',
      type: combo.type || 'synergy',
      description: combo.description || '',
      steps: combo.steps || [],
      reliability: combo.reliability || 'medium',
      setup_turns: combo.setup_turns || 5,
      mana_cost_total: combo.mana_cost_total || 0,
      power_level: combo.power_level || 5,
      colors: combo.colors || [],
      format_legal: combo.format_legal || [],
      source: 'database' as const
    }))

  } catch (error) {
    console.error('Database search error:', error)
    return []
  }
}

async function generateAICombos(supabase: any, params: any): Promise<ComboSuggestion[]> {
  try {
    const colorsText = params.colors.length > 0 
      ? `colori ${params.colors.join(', ')} (${params.colors.map(c => getColorName(c)).join(', ')})`
      : 'qualsiasi colore'
    
    const prompt = `Genera combo innovative di Magic The Gathering per questi parametri:

PARAMETRI RICHIESTI:
- Colori: ${colorsText}
- Power Level: ${params.power_level_min}-${params.power_level_max}
- Setup massimo: ${params.max_setup_turns} turni
- Carte massime per combo: ${params.max_cards}
- Formato: ${params.format}

GENERA 5-8 COMBO UNICHE E CREATIVE che rispettino questi parametri.
Evita le combo ovvie che tutti conoscono. Cerca sinergie sottili e interazioni interessanti.

${params.exclude_existing.length > 0 ? 
  `NON usare queste combo già note:\n${params.exclude_existing.slice(0, 5).map(cards => `- ${cards.join(' + ')}`).join('\n')}\n` : ''}

FORMATO JSON RICHIESTO:
{
  "combos": [
    {
      "cards": ["Nome Carta 1", "Nome Carta 2", "Nome Carta 3"],
      "category": "infinite_damage|infinite_tokens|infinite_mana|infinite_mill|win_condition|value_engine|synergy",
      "type": "infinite|synergy|win_condition|value_engine",
      "description": "Breve descrizione del risultato della combo",
      "steps": [
        "Passo 1: Cosa fare prima",
        "Passo 2: Come attivare la combo", 
        "Passo 3: Risultato finale"
      ],
      "reliability": "high|medium|low",
      "setup_turns": numero_turni_setup,
      "mana_cost_total": costo_totale_combo,
      "power_level": 1-10
    }
  ]
}

REGOLE:
- Combo devono essere REALI e funzionanti in Magic
- Nomi carte in inglese e corretti
- Power level realistico (2-4 = casual, 5-7 = competitivo, 8-10 = cEDH)
- Steps chiari e dettagliati
- Preferisci combo a 2-3 carte quando possibile

Rispondi SOLO con JSON valido, nessun testo extra.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`)
    }

    const data = await response.json()
    let responseText = data.content[0].text

    // Pulisci response da markdown
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n?/g, '').replace(/\n?```/g, '')
    }

    const aiResponse = JSON.parse(responseText)
    const generatedCombos: ComboSuggestion[] = []

    // Processa combo AI
    for (let i = 0; i < (aiResponse.combos || []).length; i++) {
      const combo = aiResponse.combos[i]
      
      const processedCombo: ComboSuggestion = {
        id: `ai_${Date.now()}_${i}`,
        cards: combo.cards || [],
        category: combo.category || 'synergy',
        type: combo.type || 'synergy', 
        description: combo.description || '',
        steps: combo.steps || [],
        reliability: combo.reliability || 'medium',
        setup_turns: combo.setup_turns || 5,
        mana_cost_total: combo.mana_cost_total || 0,
        power_level: combo.power_level || 5,
        colors: params.colors,
        format_legal: [params.format],
        source: 'ai_generated' as const
      }

      generatedCombos.push(processedCombo)

      // Step 3: Cache AI combo nel database per riuso futuro
      try {
        await supabase
          .from('combos')
          .insert({
            id: processedCombo.id,
            cards: processedCombo.cards,
            category: processedCombo.category,
            type: processedCombo.type,
            description: processedCombo.description,
            steps: processedCombo.steps,
            reliability: processedCombo.reliability,
            setup_turns: processedCombo.setup_turns,
            mana_cost_total: processedCombo.mana_cost_total,
            power_level: processedCombo.power_level,
            colors: processedCombo.colors,
            format_legal: processedCombo.format_legal,
            source: 'ai_generated',
            created_at: new Date().toISOString()
          })
      } catch (cacheError) {
        console.warn('Cache error for AI combo:', cacheError)
        // Non bloccare se il caching fallisce
      }
    }

    return generatedCombos

  } catch (error: any) {
    console.warn('AI generation failed:', error.message)
    return []
  }
}

function getColorName(colorCode: string): string {
  const colorNames: { [key: string]: string } = {
    'W': 'Bianco',
    'U': 'Blu', 
    'B': 'Nero',
    'R': 'Rosso',
    'G': 'Verde'
  }
  return colorNames[colorCode] || colorCode
}

function generateCategoryStats(combos: ComboSuggestion[]): { [key: string]: number } {
  const categories: { [key: string]: number } = {}
  
  for (const combo of combos) {
    categories[combo.category] = (categories[combo.category] || 0) + 1
  }
  
  return categories
}

// GET endpoint per test rapido
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const testColors = searchParams.get('colors')?.split(',') || ['U']
  
  console.log('Test endpoint - searching for colors:', testColors)
  
  // Crea un test POST request
  const testRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({
      colors: testColors,
      power_level_min: 1,
      power_level_max: 10,
      creative_mode: true
    }),
    headers: { 'Content-Type': 'application/json' }
  })
  
  return POST(testRequest)
}