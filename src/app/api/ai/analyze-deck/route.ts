// src/app/api/ai/analyze-deck/route.ts
import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

export const dynamic = 'force-dynamic'

interface DeckCard {
  name: string
  quantity: number
  rarity?: string
  mana_cost?: string
  type_line?: string
}

interface OptimizationSuggestion {
  type: 'add' | 'remove' | 'replace'
  card: string
  quantity: number
  reason: string
  priority: 'high' | 'medium' | 'low'
  category: 'mana_curve' | 'synergy' | 'removal' | 'win_condition' | 'consistency'
}

interface DeckAnalysis {
  total_cards: number
  mana_curve: { [key: number]: number }
  color_distribution: { [key: string]: number }
  card_types: { [key: string]: number }
  missing_cards: number
  suggestions: OptimizationSuggestion[]
  power_level: number
  consistency_score: number
  archetype: string
  win_conditions: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      deck_cards, 
      format = 'standard',
      optimization_goals = ['consistency', 'power_level', 'mana_curve']
    } = body

    if (!deck_cards || !Array.isArray(deck_cards)) {
      return NextResponse.json({
        ok: false,
        error: 'deck_cards array is required',
        expected_format: {
          deck_cards: [{ name: 'string', quantity: 'number' }],
          format: 'standard|historic|etc',
          optimization_goals: ['consistency', 'power_level', 'mana_curve']
        }
      }, { status: 400 })
    }

    console.log(`Analyzing deck with ${deck_cards.length} unique cards for ${format}...`)

    // Prima analisi: ottieni info carte da database interno
    const enrichedCards = await enrichDeckCards(deck_cards)
    
    // Seconda analisi: Claude analysis per suggerimenti
    const aiAnalysis = await performClaudeAnalysis(enrichedCards, format, optimization_goals)

    if (!aiAnalysis) {
      return NextResponse.json({
        ok: false,
        error: 'AI analysis failed'
      }, { status: 500 })
    }

    console.log(`Deck analysis complete: ${aiAnalysis.suggestions.length} suggestions generated`)

    return NextResponse.json({
      ok: true,
      analysis: aiAnalysis,
      metadata: {
        format: format,
        goals: optimization_goals,
        cards_analyzed: deck_cards.length,
        total_cards: aiAnalysis.total_cards,
        ai_model: 'claude-3-sonnet'
      }
    })

  } catch (error: any) {
    console.error('Deck analysis error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Analysis failed: ' + error.message
    }, { status: 500 })
  }
}

// Arricchisce le carte con informazioni dal database
async function enrichDeckCards(deckCards: DeckCard[]): Promise<DeckCard[]> {
  // TODO: Integrare con database carte per ottenere mana_cost, type_line, etc.
  // Per ora usiamo dati mock per non bloccare lo sviluppo
  
  return deckCards.map(card => ({
    ...card,
    // Mock data - da sostituire con query database
    mana_cost: estimateManaCost(card.name),
    type_line: estimateCardType(card.name),
    rarity: estimateRarity(card.name)
  }))
}

// Stima il mana cost basandosi sul nome (mock)
function estimateManaCost(cardName: string): string {
  const name = cardName.toLowerCase()
  
  // Carte famose con costi noti
  const knownCosts: { [key: string]: string } = {
    'lightning bolt': '{R}',
    'fulmine': '{R}',
    'counterspell': '{U}{U}',
    'contromagia': '{U}{U}',
    'giant growth': '{G}',
    'crescita gigante': '{G}',
    'dark ritual': '{B}',
    'rituale oscuro': '{B}',
    'serra angel': '{3}{W}{W}',
    'angelo serra': '{3}{W}{W}',
    'shivan dragon': '{4}{R}{R}',
    'drago di shiv': '{4}{R}{R}',
    'llanowar elves': '{G}',
    'elfi di llanowar': '{G}',
    'sol ring': '{1}',
    'anello del sole': '{1}',
    'force of will': '{3}{U}{U}',
    'forza di volonta': '{3}{U}{U}'
  }
  
  return knownCosts[name] || '{2}' // Default generico
}

// Stima il tipo di carta (mock)
function estimateCardType(cardName: string): string {
  const name = cardName.toLowerCase()
  
  if (name.includes('bolt') || name.includes('fulmine') || name.includes('shock')) return 'Instant'
  if (name.includes('counter') || name.includes('contro')) return 'Instant'
  if (name.includes('angel') || name.includes('angelo') || name.includes('dragon') || name.includes('drago') || name.includes('elves') || name.includes('elfi')) return 'Creature'
  if (name.includes('ring') || name.includes('anello') || name.includes('sol')) return 'Artifact'
  if (name.includes('growth') || name.includes('crescita')) return 'Instant'
  if (name.includes('ritual') || name.includes('rituale')) return 'Instant'
  
  return 'Spell' // Default
}

// Stima la rarità (mock)
function estimateRarity(cardName: string): string {
  const name = cardName.toLowerCase()
  
  const rares = ['serra angel', 'angelo serra', 'shivan dragon', 'drago di shiv', 'force of will', 'forza di volonta']
  const mythics = ['sol ring', 'anello del sole'] // In realtà è uncommon ma per test
  
  if (mythics.some(r => name.includes(r))) return 'mythic'
  if (rares.some(r => name.includes(r))) return 'rare'
  if (name.includes('bolt') || name.includes('fulmine') || name.includes('growth') || name.includes('crescita')) return 'common'
  
  return 'uncommon'
}

// Analisi Claude principale
async function performClaudeAnalysis(
  cards: DeckCard[], 
  format: string,
  goals: string[]
): Promise<DeckAnalysis | null> {
  try {
    const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0)
    
    const prompt = `Sei un esperto deck builder di Magic The Gathering. Analizza questo deck e fornisci suggerimenti per ottimizzarlo.

DECK DA ANALIZZARE:
${cards.map(card => `${card.quantity}x ${card.name} (${card.type_line}, ${card.mana_cost})`).join('\n')}

FORMATO: ${format.toUpperCase()}
OBIETTIVI: ${goals.join(', ')}
CARTE TOTALI: ${totalCards}/60

FORNISCI ANALISI COMPLETA IN QUESTO FORMATO JSON:
{
  "total_cards": ${totalCards},
  "archetype": "Aggro/Midrange/Control/Combo",
  "power_level": 1-10,
  "consistency_score": 1-100,
  "win_conditions": ["Lista delle win condition principali"],
  "suggestions": [
    {
      "type": "add|remove|replace",
      "card": "Nome carta",
      "quantity": numero,
      "reason": "Spiegazione dettagliata perché aggiungere/rimuovere",
      "priority": "high|medium|low",
      "category": "mana_curve|synergy|removal|win_condition|consistency"
    }
  ]
}

CONSIDERA:
- Curva di mana ottimale per l'archetipo
- Bilanciamento creature/spell
- Removal e interaction
- Win condition consistenti
- Sinergie tra carte
- Meta ${format} attuale

REGOLE:
- Se deck ha meno di 60 carte, suggerisci aggiunte per arrivare a 60
- Se ha più di 60, suggerisci rimozioni
- Massimo 8 suggerimenti, priorità ai più importanti
- Spiega sempre il "perché" di ogni suggerimento
- Supporta nomi carte sia inglesi che italiani

Rispondi SOLO con JSON valido, nessun testo aggiuntivo.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [
          { 
            role: 'user', 
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`)
    }

    const data = await response.json()
    const aiResponseText = data.content[0].text

    // Pulisci la risposta da markdown o testo extra
    let cleanJsonText = aiResponseText.trim()
    
    // Rimuovi markdown code blocks se presenti
    if (cleanJsonText.startsWith('```json')) {
      cleanJsonText = cleanJsonText.replace(/```json\n?/g, '').replace(/\n?```/g, '')
    } else if (cleanJsonText.startsWith('```')) {
      cleanJsonText = cleanJsonText.replace(/```\n?/g, '').replace(/\n?```/g, '')
    }

    const analysis = JSON.parse(cleanJsonText)

    // Validazione e defaults
    return {
      total_cards: totalCards,
      mana_curve: calculateManaCurve(cards),
      color_distribution: calculateColorDistribution(cards),
      card_types: calculateCardTypes(cards),
      missing_cards: Math.max(0, 60 - totalCards),
      suggestions: analysis.suggestions || [],
      power_level: analysis.power_level || 5,
      consistency_score: analysis.consistency_score || 50,
      archetype: analysis.archetype || 'Unknown',
      win_conditions: analysis.win_conditions || []
    }

  } catch (error: any) {
    console.error('Claude analysis error:', error)
    
    // Fallback analysis se Claude fallisce
    return {
      total_cards: cards.reduce((sum, card) => sum + card.quantity, 0),
      mana_curve: calculateManaCurve(cards),
      color_distribution: calculateColorDistribution(cards),
      card_types: calculateCardTypes(cards),
      missing_cards: Math.max(0, 60 - cards.reduce((sum, card) => sum + card.quantity, 0)),
      suggestions: generateFallbackSuggestions(cards),
      power_level: 5,
      consistency_score: 50,
      archetype: 'Mixed',
      win_conditions: ['Creature damage']
    }
  }
}

// Genera suggerimenti di fallback se Claude non è disponibile
function generateFallbackSuggestions(cards: DeckCard[]): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0)
  
  if (totalCards < 60) {
    suggestions.push({
      type: 'add',
      card: 'Terreni Base',
      quantity: 60 - totalCards,
      reason: `Aggiungi ${60 - totalCards} carte per raggiungere il minimo di 60 carte richieste nel formato Standard.`,
      priority: 'high',
      category: 'consistency'
    })
  }
  
  if (totalCards > 60) {
    suggestions.push({
      type: 'remove',
      card: 'Carte meno efficaci',
      quantity: totalCards - 60,
      reason: `Rimuovi ${totalCards - 60} carte per ottimizzare la consistenza del deck.`,
      priority: 'high', 
      category: 'consistency'
    })
  }
  
  return suggestions
}

// Calcola curva di mana
function calculateManaCurve(cards: DeckCard[]): { [key: number]: number } {
  const curve: { [key: number]: number } = {}
  
  for (const card of cards) {
    // Stima CMC dal mana cost (semplificato)
    const cmc = estimateCMC(card.mana_cost || '')
    curve[cmc] = (curve[cmc] || 0) + card.quantity
  }
  
  return curve
}

// Stima CMC da mana cost string
function estimateCMC(manaCost: string): number {
  if (!manaCost) return 0
  
  // Conta i numeri e i simboli di mana
  const matches = manaCost.match(/\d+|\{[^}]+\}/g)
  if (!matches) return 0
  
  let total = 0
  for (const match of matches) {
    if (match.match(/^\d+$/)) {
      total += parseInt(match)
    } else {
      total += 1 // Ogni simbolo di mana colorato = 1
    }
  }
  
  return total
}

// Calcola distribuzione colori
function calculateColorDistribution(cards: DeckCard[]): { [key: string]: number } {
  const colors: { [key: string]: number } = { W: 0, U: 0, B: 0, R: 0, G: 0, Colorless: 0 }
  
  for (const card of cards) {
    const manaCost = card.mana_cost || ''
    if (manaCost.includes('W')) colors.W += card.quantity
    if (manaCost.includes('U')) colors.U += card.quantity
    if (manaCost.includes('B')) colors.B += card.quantity
    if (manaCost.includes('R')) colors.R += card.quantity
    if (manaCost.includes('G')) colors.G += card.quantity
    if (!manaCost.match(/[WUBRG]/)) colors.Colorless += card.quantity
  }
  
  return colors
}

// Calcola tipi di carta
function calculateCardTypes(cards: DeckCard[]): { [key: string]: number } {
  const types: { [key: string]: number } = {}
  
  for (const card of cards) {
    const type = (card.type_line || 'Unknown').split(/[\s—-]/)[0]
    types[type] = (types[type] || 0) + card.quantity
  }
  
  return types
}