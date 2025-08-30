// src/app/api/discover/combo-from-cards/route.ts
// API endpoint per scoprire combo dalle carte seed dell'utente

import { NextRequest, NextResponse } from 'next/server'
import { ComboDiscoveryEngine } from '../../../../lib/combo-discovery'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface DiscoverRequest {
  seed_card_ids: string[]
  format: 'standard' | 'historic' | 'brawl'
  max_combos?: number
  min_power_level?: number
  colors_filter?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const body: DiscoverRequest = await req.json()
    
    // Validazione input
    if (!body.seed_card_ids || body.seed_card_ids.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Devi fornire almeno una carta seed' 
      }, { status: 400 })
    }

    if (body.seed_card_ids.length > 10) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Massimo 10 carte seed per ricerca' 
      }, { status: 400 })
    }

    const format = body.format || 'standard'
    const maxCombos = body.max_combos || 15
    const minPowerLevel = body.min_power_level || 5

    console.log(`Ricerca combo da ${body.seed_card_ids.length} carte in formato ${format}`)

    // Inizializza il motore di scoperta
    const engine = new ComboDiscoveryEngine()
    await engine.initialize(format)

    // Scopri combo dalle carte seed
    const startTime = Date.now()
    const discoveredCombos = await engine.discoverCombosFromCards(body.seed_card_ids, format)
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
        (limitedCombos.reduce((sum, c) => sum + c.power_level, 0) / limitedCombos.length).toFixed(1) : 0,
      avg_mana_cost: limitedCombos.length > 0 ?
        (limitedCombos.reduce((sum, c) => sum + c.mana_cost, 0) / limitedCombos.length).toFixed(1) : 0
    }

    // Trova sinergie aggiuntive tra le carte seed (anche se non formano combo complete)
    const { synergies, explanations } = await engine.findSynergiesBetweenCards(body.seed_card_ids)

    return NextResponse.json({
      ok: true,
      combos: limitedCombos,
      combos_by_type: combosByType,
      synergies,
      explanations,
      stats,
      suggestions: generateSuggestions(limitedCombos, body.seed_card_ids)
    })

  } catch (error: any) {
    console.error('Errore nella scoperta combo:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Errore interno del server' 
    }, { status: 500 })
  }
}

function generateSuggestions(combos: any[], seedCardIds: string[]): string[] {
  const suggestions: string[] = []

  if (combos.length === 0) {
    suggestions.push('Non sono state trovate combo dirette, prova ad aggiungere carte con meccaniche complementari')
    suggestions.push('Cerca carte con "enters the battlefield", "sacrifice", o "tap/untap" per creare sinergie')
    suggestions.push('Considera carte che generano token o mana per abilitare combo')
  } else {
    const infiniteCombos = combos.filter(c => c.type.includes('infinite'))
    const valueCombos = combos.filter(c => c.type === 'value_engine')
    
    if (infiniteCombos.length > 0) {
      suggestions.push(`Trovate ${infiniteCombos.length} combo infinite potenti!`)
      suggestions.push('Aggiungi protezione e tutors per rendere le combo più consistenti')
    }
    
    if (valueCombos.length > 0) {
      suggestions.push(`Trovati ${valueCombos.length} motori di valore che generano vantaggio progressivo`)
    }

    const highCostCombos = combos.filter(c => c.mana_cost > 8)
    if (highCostCombos.length > 0) {
      suggestions.push('Alcune combo hanno costo alto, considera ramp o riduttori di costo')
    }

    const multiColorCombos = combos.filter(c => c.colors_required.length > 2)
    if (multiColorCombos.length > 0) {
      suggestions.push('Combo multicolore trovate: assicurati di avere una mana base solida')
    }
  }

  return suggestions
}

// Endpoint GET per test rapidi
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const cardIds = url.searchParams.get('cards')?.split(',') || []
  const format = url.searchParams.get('format') as 'standard' | 'historic' | 'brawl' || 'standard'
  
  if (cardIds.length === 0) {
    return NextResponse.json({ 
      ok: false, 
      error: 'Fornisci carte come: ?cards=id1,id2,id3&format=standard' 
    }, { status: 400 })
  }

  try {
    const engine = new ComboDiscoveryEngine()
    const combos = await engine.discoverCombosFromCards(cardIds, format)
    
    return NextResponse.json({
      ok: true,
      combos: combos.slice(0, 5),
      found: combos.length
    })
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}