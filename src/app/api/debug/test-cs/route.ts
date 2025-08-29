// src/app/api/debug/test-cs/route.ts
// Endpoint di debug per testare la connessione a Commander Spellbook API

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('Testing Commander Spellbook API connection...')
    
    // Test connessione base
    const response = await fetch('https://backend.commanderspellbook.com/combos/', {
      headers: {
        'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
        'Accept': 'application/json'
      }
    })
    
    console.log(`API Response Status: ${response.status}`)
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API returned status ${response.status}`,
        status: response.status,
        statusText: response.statusText
      })
    }

    const data = await response.json()
    console.log(`Received data with ${data.results?.length || 0} combos`)
    
    // Analizza primo combo per struttura dati
    const firstCombo = data.results?.[0] || null
    const comboStructure = firstCombo ? {
      hasUses: !!firstCombo.uses,
      usesLength: firstCombo.uses?.length || 0,
      hasProduces: !!firstCombo.produces,
      producesLength: firstCombo.produces?.length || 0,
      hasDescription: !!firstCombo.description,
      hasPermalink: !!firstCombo.permalink,
      cardNames: firstCombo.uses?.map((use: any) => use.card?.name).filter(Boolean) || []
    } : null

    return NextResponse.json({
      success: true,
      status: response.status,
      combosCount: data.results?.length || 0,
      totalPages: data.count ? Math.ceil(data.count / (data.results?.length || 1)) : 1,
      firstCombo: {
        structure: comboStructure,
        raw: firstCombo
      },
      apiHealth: {
        responseTime: Date.now(),
        dataComplete: !!(data.results && data.results.length > 0),
        hasValidCards: comboStructure?.cardNames?.length > 0
      }
    })
    
  } catch (error) {
    console.error('Commander Spellbook API test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof TypeError ? 'Network/Fetch Error' : 'Processing Error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to test Commander Spellbook API',
    usage: 'GET /api/debug/test-cs'
  }, { status: 405 })
}