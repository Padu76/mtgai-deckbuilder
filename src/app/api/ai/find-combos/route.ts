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

    console.log(`[FIND-COMBOS] Starting search: colors=${colors.join(',')}, power=${power_level_min}-${power_level_max}, format=${format}, creative=${creative_mode}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Step 1: Cerca nel database esistente
    console.log('[FIND-COMBOS] Step 1: Searching database...')
    const databaseCombos = await searchDatabaseCombos(supabase, {
      colors,
      power_level_min,
      power_level_max,
      max_setup_turns,
      max_cards,
      reliability,
      format
    })

    console.log(`[FIND-COMBOS] Found ${databaseCombos.length} combos in database`)

    // Step 2: Se pochi risultati, genera con AI
    let aiCombos: ComboSuggestion[] = []
    const shouldUseAI = databaseCombos.length < 5
    
    console.log(`[FIND-COMBOS] Should use AI: ${shouldUseAI} (database combos: ${databaseCombos.length})`)

    if (shouldUseAI || creative_mode) {
      console.log('[FIND-COMBOS] Step 2: Generating AI combos...')
      
      try {
        aiCombos = await generateAICombos(supabase, {
          colors,
          power_level_min,
          power_level_max, 
          max_setup_turns,
          max_cards,
          format,
          creative_mode,
          exclude_existing: databaseCombos.map(c => c.cards)
        })
        console.log(`[FIND-COMBOS] Generated ${aiCombos.length} new AI combos`)
      } catch (aiError) {
        console.error('[FIND-COMBOS] AI generation failed:', aiError)
        // Continue with database results only
      }
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
        creative_mode_used: creative_mode
      },
      filters_applied: {
        colors: colors.length > 0 ? colors : [],
        power_range: [power_level_min, power_level_max],
        max_setup_turns,
        max_cards,
        reliability,
        format
      },
      categories: generateCategoryStats(allCombos)
    }

    console.log(`[FIND-COMBOS] Returning ${response.combos.length} total combos`)
    return NextResponse.json(response)

  } catch (error: any) {
    console.error('[FIND-COMBOS] Main error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Combo search failed: ' + error.message,
      fallback_available: true
    }, { status: 500 })
  }
}

async function searchDatabaseCombos(supabase: any, filters: ComboFilters): Promise<ComboSuggestion[]> {
  try {
    console.log('[DB-SEARCH] Starting database search with filters:', filters)
    
    let query = supabase
      .from('combos')
      .select('*')

    // Filtri di base
    if (filters.power_level_min) {
      query = query.gte('power_level', filters.power_level_min)
    }
    if (filters.power_level_max) {
      query = query.lte('power_level', filters.power_level_max)
    }
    if (filters.max_setup_turns) {
      query = query.lte('setup_turns', filters.max_setup_turns)
    }
    
    // Filtro reliability - semplificato
    if (filters.reliability && filters.reliability.length > 0) {
      query = query.in('reliability', filters.reliability)
    }

    const { data, error } = await query
      .order('power_level', { ascending: false })
      .limit(50) // Prendi più risultati, poi filtra
    
    if (error) {
      console.error('[DB-SEARCH] Database query error:', error)
      return []
    }

    console.log(`[DB-SEARCH] Raw database results: ${(data || []).length}`)

    // Post-filtro per colori e altre proprietà complesse
    let filteredData = data || []
    
    // Filtro colori - più semplice
    if (filters.colors && filters.colors.length > 0) {
      filteredData = filteredData.filter((combo: any) => {
        const comboColors = combo.colors || []
        return filters.colors!.some(filterColor => 
          comboColors.includes(filterColor)
        )
      })
    }

    // Filtro numero carte
    if (filters.max_cards) {
      filteredData = filteredData.filter((combo: any) => {
        const cards = combo.cards || []
        return cards.length <= filters.max_cards!
      })
    }

    console.log(`[DB-SEARCH] After filtering: ${filteredData.length} combos`)

    // Converti al formato ComboSuggestion
    return filteredData.map((combo: any) => ({
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
    console.error('[DB-SEARCH] Database search error:', error)
    return []
  }
}

async function generateAICombos(supabase: any, params: any): Promise<ComboSuggestion[]> {
  try {
    console.log('[AI-GEN] Starting AI generation with params:', {
      colors: params.colors,
      creative_mode: params.creative_mode,
      format: params.format
    })

    const colorsText = params.colors.length > 0 
      ? `colori ${params.colors.join(', ')} (${params.colors.map((c: string) => getColorName(c)).join(', ')})`
      : 'qualsiasi colore'
    
    // Prompt diverso per creative vs standard mode
    let modeInstructions = ''
    if (params.creative_mode) {
      modeInstructions = `
MODALITÀ CREATIVA: Genera combo INNOVATIVE e UNICHE che sfruttano:
- Interazioni rare tra meccaniche diverse
- Carte poco usate ma potenti
- Timing tricks e finestre temporali
- Effetti di sostituzione inaspettati
EVITA combo ovvie che tutti conoscono.`
    } else {
      modeInstructions = `
MODALITÀ STANDARD: Genera combo AFFIDABILI e TESTATE che includono:
- Combo consolidate del meta
- Pattern di gioco riconosciuti  
- Carte popolari e accessibili
- Strategie provate in torneo
PRIORITÀ su combo che funzionano davvero.`
    }
    
    const prompt = `Sei un esperto di Magic The Gathering. ${modeInstructions}

PARAMETRI RICHIESTI:
- Colori: ${colorsText}
- Power Level: ${params.power_level_min}-${params.power_level_max}
- Setup massimo: ${params.max_setup_turns} turni
- Carte massime per combo: ${params.max_cards}
- Formato: ${params.format}

GENERA 6-8 COMBO che rispettino ESATTAMENTE questi parametri.

${params.exclude_existing.length > 0 ? 
  `NON ripetere queste combo già trovate:\n${params.exclude_existing.slice(0, 3).map((cards: string[]) => `- ${cards.join(' + ')}`).join('\n')}\n` : ''}

Per colore BLU (U), esempi di archetipi:
- Mill/Draw damage combo
- Infinite mana con artifacts
- Creature bounce loops
- Counter + win conditions
- Laboratory Maniac effects

FORMATO JSON RICHIESTO (SOLO JSON, NESSUN ALTRO TESTO):
{
  "combos": [
    {
      "cards": ["Card Name 1", "Card Name 2", "Card Name 3"],
      "category": "infinite_damage|infinite_tokens|infinite_mana|draw_damage|win_condition|value_engine",
      "type": "infinite|synergy|win_condition|value_engine",
      "description": "Breve descrizione dell'effetto della combo",
      "steps": [
        "Step 1: Setup requirement",
        "Step 2: Activation method", 
        "Step 3: Win condition result"
      ],
      "reliability": "high|medium|low",
      "setup_turns": ${params.max_setup_turns},
      "mana_cost_total": 6,
      "power_level": ${Math.floor((params.power_level_min + params.power_level_max) / 2)}
    }
  ]
}

REGOLE CRITICHE:
- Nomi carte in INGLESE e CORRETTI
- Combo devono essere REALI e funzionanti
- JSON VALIDO senza errori di sintassi
- Non usare markdown o formattazione extra`

    console.log('[AI-GEN] Calling Claude API...')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: params.creative_mode ? 0.8 : 0.3,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()
    let responseText = data.content[0].text.trim()

    console.log('[AI-GEN] Raw Claude response length:', responseText.length)

    // Pulisci response da markdown
    if (responseText.includes('```json')) {
      const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        responseText = jsonMatch[1]
      }
    }

    // Rimuovi eventuali testi prima/dopo il JSON
    const jsonStart = responseText.indexOf('{')
    const jsonEnd = responseText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      responseText = responseText.substring(jsonStart, jsonEnd + 1)
    }

    console.log('[AI-GEN] Cleaned response for parsing:', responseText.substring(0, 200) + '...')

    let aiResponse
    try {
      aiResponse = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[AI-GEN] JSON parse error:', parseError)
      console.error('[AI-GEN] Failed to parse:', responseText)
      throw new Error('Invalid JSON response from AI')
    }

    const generatedCombos: ComboSuggestion[] = []

    // Processa combo AI
    for (let i = 0; i < (aiResponse.combos || []).length; i++) {
      const combo = aiResponse.combos[i]
      
      const processedCombo: ComboSuggestion = {
        id: `ai_combo_${Date.now()}_${i}`,
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

      // Cache AI combo nel database per riuso futuro
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
        console.log(`[AI-GEN] Cached combo ${processedCombo.id} to database`)
      } catch (cacheError) {
        console.warn('[AI-GEN] Cache warning (non-blocking):', cacheError)
        // Non bloccare se il caching fallisce
      }
    }

    console.log(`[AI-GEN] Successfully generated ${generatedCombos.length} combos`)
    return generatedCombos

  } catch (error: any) {
    console.error('[AI-GEN] AI generation failed:', error)
    throw error // Re-throw per permettere handling upstream
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
  
  console.log('[GET-TEST] Test endpoint - searching for colors:', testColors)
  
  // Crea un test POST request
  const testRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({
      colors: testColors,
      power_level_min: 1,
      power_level_max: 10,
      creative_mode: false, // Test modalità standard
      format: 'historic'
    }),
    headers: { 'Content-Type': 'application/json' }
  })
  
  return POST(testRequest)
}