// src/app/api/debug/test-cs/route.ts
// Enhanced debug endpoint per testare diversi URL Commander Spellbook

import { NextResponse } from 'next/server'

// Lista di possibili URL da testare
const TEST_URLS = [
  'https://backend.commanderspellbook.com/combos/',
  'https://backend.commanderspellbook.com/combos',
  'https://api.commanderspellbook.com/combos/',
  'https://api.commanderspellbook.com/combos',
  'https://commanderspellbook.com/api/combos/',
  'https://commanderspellbook.com/api/combos',
  'https://backend.commanderspellbook.com/api/combos/',
  'https://backend.commanderspellbook.com/api/combos',
  'https://spellbook-backend.herokuapp.com/combos/',
  'https://spellbook-backend.herokuapp.com/combos'
]

// Test diversi headers
const TEST_HEADERS = {
  basic: {
    'Accept': 'application/json'
  },
  withUserAgent: {
    'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
    'Accept': 'application/json'
  },
  minimal: {
    'Accept': '*/*'
  },
  browser: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*'
  }
}

async function testUrl(url: string, headers: any): Promise<any> {
  try {
    const response = await fetch(url, { 
      headers,
      method: 'GET'
    })
    
    const responseData = {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      success: response.ok
    }

    if (response.ok) {
      try {
        const data = await response.json()
        return {
          ...responseData,
          hasData: true,
          combosCount: data.results?.length || data.length || 0,
          dataStructure: {
            hasResults: !!data.results,
            hasCount: !!data.count,
            isArray: Array.isArray(data),
            keys: Object.keys(data || {})
          },
          firstCombo: data.results?.[0] || data[0] || null
        }
      } catch (jsonError) {
        const text = await response.text()
        return {
          ...responseData,
          hasData: false,
          jsonError: 'Invalid JSON',
          responseText: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        }
      }
    } else {
      return {
        ...responseData,
        hasData: false,
        errorBody: await response.text().catch(() => 'Could not read error body')
      }
    }
  } catch (error) {
    return {
      url,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof TypeError ? 'Network/DNS Error' : 'Other Error'
    }
  }
}

export async function GET() {
  console.log('Testing multiple Commander Spellbook endpoints...')
  
  const results = []
  
  // Test ogni URL con diversi headers
  for (const url of TEST_URLS) {
    console.log(`Testing URL: ${url}`)
    
    // Test con headers di base
    const basicTest = await testUrl(url, TEST_HEADERS.basic)
    results.push({ ...basicTest, headerType: 'basic' })
    
    // Se il primo test fallisce, prova altri headers
    if (!basicTest.success) {
      const userAgentTest = await testUrl(url, TEST_HEADERS.withUserAgent)
      if (userAgentTest.success) {
        results.push({ ...userAgentTest, headerType: 'withUserAgent' })
        break // Se trova un URL funzionante, interrompe
      }
    } else {
      break // Se trova un URL funzionante, interrompe
    }
    
    // Piccola pausa per evitare rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Trova il primo risultato di successo
  const workingEndpoint = results.find(r => r.success)
  
  // Test aggiuntivo: verifica se Commander Spellbook è completamente down
  let websiteStatus = null
  try {
    const siteResponse = await fetch('https://commanderspellbook.com', { 
      headers: TEST_HEADERS.browser,
      method: 'HEAD'
    })
    websiteStatus = {
      status: siteResponse.status,
      accessible: siteResponse.ok
    }
  } catch {
    websiteStatus = { accessible: false, error: 'Website unreachable' }
  }

  return NextResponse.json({
    summary: {
      totalTests: results.length,
      successfulTests: results.filter(r => r.success).length,
      workingEndpoint: workingEndpoint ? workingEndpoint.url : null,
      recommendedHeaders: workingEndpoint ? workingEndpoint.headerType : null
    },
    websiteStatus,
    allResults: results,
    workingEndpointDetails: workingEndpoint ? {
      url: workingEndpoint.url,
      combosFound: workingEndpoint.combosCount || 0,
      dataStructure: workingEndpoint.dataStructure,
      sampleCombo: workingEndpoint.firstCombo ? {
        hasCards: !!(workingEndpoint.firstCombo.uses || workingEndpoint.firstCombo.cards),
        hasResults: !!(workingEndpoint.firstCombo.produces || workingEndpoint.firstCombo.results),
        cardCount: (workingEndpoint.firstCombo.uses?.length || workingEndpoint.firstCombo.cards?.length || 0),
        cardNames: (workingEndpoint.firstCombo.uses?.map((u: any) => u.card?.name) || 
                   workingEndpoint.firstCombo.cards?.map((c: any) => c.name) || []).filter(Boolean)
      } : null
    } : null,
    timestamp: new Date().toISOString(),
    nextSteps: workingEndpoint 
      ? "Working endpoint found! Use this URL and headers in the main import."
      : "No working endpoints found. Commander Spellbook API may be down or changed."
  })
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to test Commander Spellbook API endpoints',
    usage: 'GET /api/debug/test-cs'
  }, { status: 405 })
}