// src/app/api/discover/combo-by-archetype/route.ts
// API endpoint per scoprire combo da colori e archetipi

import { NextRequest, NextResponse } from 'next/server'
import { ComboDiscoveryEngine } from '../../../../lib/combo-discovery'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ArchetypeRequest {
  colors: string[]
  archetype: string
  format: 'standard' | 'historic' | 'brawl'
  max_combos?: number
  min_power_level?: number
}

export async function POST(req: NextRequest) {
  try {
    const body: ArchetypeRequest = await req.json()
    
    // Validazione input
    if (body.colors.length === 0 && !body.archetype) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Specifica almeno un colore o un archetipo' 
      }, { status: 400 })
    }

    // Validazione colori
    const validColors = ['W', 'U', 'B', 'R', 'G']
    const invalidColors = body.colors.filter(color => !validColors.includes(color))
    if (invalidColors.length > 0) {
      return NextResponse.json({ 
        ok: false, 
        error: `Colori non validi: ${invalidColors.join(', ')}` 
      }, { status: 400 })
    }

    const format = body.format || 'standard'
    const maxCombos = Math.min(body.max_combos || 20, 50)
    const minPowerLevel = body.min_power_level || 4

    console.log(`Ricerca combo per colori ${body.colors.join('')} e archetipo "${body.archetype}" in formato ${format}`)

    // Inizializza il motore di scoperta
    const engine = new ComboDiscoveryEngine()
    await engine.initialize(format)

    // Scopri combo per archetipo
    const startTime = Date.now()
    const discoveredCombos = await engine.discoverCombosByArchetype(
      body.colors, 
      body.archetype || '', 
      format
    )
    const analysisTime = Date.now() - startTime

    // Filtra per power level minimo
    const filteredCombos = discoveredCombos.filter(combo => combo.power_level >= minPowerLevel)

    // Limita numero risultati
    const limitedCombos = filteredCombos.slice(0, maxCombos)

    // Raggruppa combo per tipo
    const combosByType = limitedCombos.reduce((acc, combo) => {
      if (!acc[combo.type]) acc[combo.type] = []
      acc[combo.type].push(combo)
      return acc
    }, {} as Record<string, any[]>)

    // Calcola statistiche
    const stats = {
      total_analyzed: discoveredCombos.length,
      filtered_results: filteredCombos.length,
      returned_results: limitedCombos.length,
      analysis_time_ms: analysisTime,
      combo_types_found: Object.keys(combosByType),
      avg_power_level: limitedCombos.length > 0 ? 
        (limitedCombos.reduce((sum, c) => sum + c.power_level, 0) / limitedCombos.length).toFixed(1) : '0',
      avg_mana_cost: limitedCombos.length > 0 ?
        (limitedCombos.reduce((sum, c) => sum + c.mana_cost, 0) / limitedCombos.length).toFixed(1) : '0'
    }

    // Genera suggerimenti basati sui risultati
    const suggestions = generateArchetypeSuggestions(
      limitedCombos, 
      body.colors, 
      body.archetype,
      stats
    )

    return NextResponse.json({
      ok: true,
      combos: limitedCombos,
      combos_by_type: combosByType,
      stats,
      suggestions,
      search_params: {
        colors: body.colors,
        archetype: body.archetype,
        format
      }
    })

  } catch (error: any) {
    console.error('Errore nella scoperta combo per archetipo:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Errore interno del server' 
    }, { status: 500 })
  }
}

function generateArchetypeSuggestions(
  combos: any[], 
  colors: string[], 
  archetype: string, 
  stats: any
): string[] {
  const suggestions: string[] = []

  if (combos.length === 0) {
    suggestions.push('Nessuna combo innovativa trovata per questa combinazione')
    
    if (colors.length > 3) {
      suggestions.push('Prova a ridurre il numero di colori per combo più consistenti')
    } else if (colors.length === 0) {
      suggestions.push('Specifica alcuni colori per restringere la ricerca')
    }
    
    if (archetype) {
      suggestions.push(`L'archetipo "${archetype}" potrebbe essere troppo specifico, prova termini più generali`)
      suggestions.push('Archetipi come "artifacts", "tokens" o "lifegain" spesso offrono più possibilità')
    } else {
      suggestions.push('Specifica un archetipo per trovare sinergie più mirate')
    }
    
    suggestions.push('Le combo più innovative spesso si trovano in combinazioni di colori inusuali')
  } else {
    const avgPowerLevel = parseFloat(stats.avg_power_level)
    const avgManaCost = parseFloat(stats.avg_mana_cost)
    
    if (avgPowerLevel >= 8) {
      suggestions.push('Combo ad alta potenza trovate! Considera protezione e setup affidabile')
    } else if (avgPowerLevel <= 5) {
      suggestions.push('Combo moderate trovate, potrebbero essere più sicure in ambiente competitivo')
    }
    
    if (avgManaCost > 8) {
      suggestions.push('Combo costose: aggiungi acceleratori di mana o riduzioni di costo')
    } else if (avgManaCost <= 4) {
      suggestions.push('Combo efficienti: perfette per formati veloci come Standard')
    }
    
    // Suggerimenti basati sui tipi di combo trovati
    const infiniteCombos = combos.filter(c => c.type.includes('infinite'))
    const valueCombos = combos.filter(c => c.type === 'value_engine')
    
    if (infiniteCombos.length > valueCombos.length) {
      suggestions.push('Più combo infinite che motori di valore: considera backup plans')
    } else if (valueCombos.length > 0) {
      suggestions.push('Motori di valore trovati: ideali per partite lunghe')
    }
    
    // Suggerimenti sui colori
    if (colors.length === 1) {
      suggestions.push('Mono-colore: considera splash per accedere a enabler aggiuntivi')
    } else if (colors.length >= 3) {
      suggestions.push('Multi-colore: mana base solida essenziale per consistenza')
    }
    
    // Suggerimenti specifici per archetype
    if (archetype) {
      switch (archetype.toLowerCase()) {
        case 'artifacts':
          suggestions.push('Combo artifacts: cerca cost reducers e free artifacts per accelerare')
          break
        case 'tokens':
          suggestions.push('Token combo: mass pump effects rendono i token letali')
          break
        case 'lifegain':
          suggestions.push('Lifegain combo: payoffs multipli rendono il motore più resiliente')
          break
        case 'sacrifice':
          suggestions.push('Sacrifice combo: token generators forniscono fuel infinito')
          break
        case 'spells':
          suggestions.push('Spells combo: cost reduction e cantrips mantengono il motore attivo')
          break
      }
    }
  }

  // Suggerimento finale
  if (combos.length > 0) {
    suggestions.push('Testa queste combo in simulatori prima del craft per verificare consistenza')
  }

  return suggestions
}

// Endpoint GET per test rapidi con query params
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const colors = url.searchParams.get('colors')?.split('') || []
  const archetype = url.searchParams.get('archetype') || ''
  const format = url.searchParams.get('format') as 'standard' | 'historic' | 'brawl' || 'standard'
  
  if (colors.length === 0 && !archetype) {
    return NextResponse.json({ 
      ok: false, 
      error: 'Fornisci colori o archetipo: ?colors=WU&archetype=artifacts&format=standard' 
    }, { status: 400 })
  }

  try {
    const engine = new ComboDiscoveryEngine()
    const combos = await engine.discoverCombosByArchetype(colors, archetype, format)
    
    return NextResponse.json({
      ok: true,
      combos: combos.slice(0, 10),
      found: combos.length,
      search: { colors, archetype, format }
    })
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}