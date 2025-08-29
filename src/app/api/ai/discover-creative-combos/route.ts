// src/app/api/ai/discover-creative-combos/route.ts
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
  rarity: string | null
  set_code: string | null
  image_url: string | null
  legal_standard?: boolean
  legal_historic?: boolean
  legal_brawl?: boolean
}

interface CreativeCombo {
  id: string
  cards: Card[]
  category: string
  creativity_score: number
  obscurity_level: 'rare' | 'obscure' | 'hidden' | 'unknown'
  description: string
  explanation: string[]
  setup_steps: string[]
  timing_requirements: string[]
  rules_interactions: string[]
  power_level: number
  consistency: number
  discovery_method: string
  format_legal: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      colors, 
      format = 'historic', 
      creativity_level = 'high',
      max_combo_pieces = 4,
      include_obscure_cards = true,
      min_power_level = 6
    } = body

    if (!colors || colors.length === 0) {
      return NextResponse.json({ 
        error: 'Colors array is required',
        ok: false 
      }, { status: 400 })
    }

    console.log(`Discovering creative combos for colors: ${colors.join(', ')}, format: ${format}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get comprehensive card pool for both Standard and Historic Brawl
    let query = supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)

    // Format-agnostic approach - get all potentially legal cards
    if (format === 'standard') {
      query = query.eq('legal_standard', true)
    } else {
      // For Historic Brawl, get historic + brawl legal cards
      query = query.or('legal_historic.eq.true,legal_brawl.eq.true')
    }

    const { data: cards, error } = await query.limit(6000)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        error: 'Database error: ' + error.message,
        ok: false 
      }, { status: 500 })
    }

    // Filter for creative potential across formats
    const creativeCards = filterForCreativity(cards || [], colors, include_obscure_cards, format)
    console.log(`Found ${creativeCards.length} cards with creative potential`)

    // Discover creative combos using multiple discovery methods
    const discoveries = await discoverCreativeCombos(
      creativeCards, 
      colors, 
      format, 
      creativity_level,
      max_combo_pieces,
      min_power_level
    )

    // Rank by creativity and viability
    const rankedCombos = discoveries
      .sort((a, b) => {
        const scoreA = (a.creativity_score * 0.6) + (a.power_level * 0.3) + (a.consistency * 0.1)
        const scoreB = (b.creativity_score * 0.6) + (b.power_level * 0.3) + (b.consistency * 0.1)
        return scoreB - scoreA
      })
      .slice(0, 20)

    return NextResponse.json({
      ok: true,
      creative_combos: rankedCombos,
      total_discovered: discoveries.length,
      creativity_level,
      discovery_methods_used: [...new Set(rankedCombos.map(c => c.discovery_method))],
      colors_analyzed: colors,
      format,
      stats: {
        obscurity_distribution: getObscurityStats(rankedCombos),
        avg_creativity_score: rankedCombos.reduce((sum, c) => sum + c.creativity_score, 0) / rankedCombos.length,
        format_coverage: getFormatCoverage(rankedCombos)
      }
    })

  } catch (error: any) {
    console.error('Error discovering creative combos:', error)
    return NextResponse.json({ 
      error: 'Discovery failed: ' + (error.message || 'Unknown error'),
      ok: false 
    }, { status: 500 })
  }
}

function filterForCreativity(cards: Card[], colors: string[], includeObscure: boolean, format: string): Card[] {
  return cards.filter(card => {
    try {
      if (!card.name || !card.oracle_text) return false
      
      // Strict color identity matching
      const cardColors = card.color_identity || []
      if (cardColors.length > 0 && !cardColors.every(color => colors.includes(color))) {
        return false
      }

      const text = card.oracle_text.toLowerCase()
      
      // Creative potential indicators with higher weight for obscure mechanics
      const creativityIndicators = [
        // Alternative costs (high creativity)
        { pattern: 'without paying', weight: 3 },
        { pattern: 'alternative cost', weight: 3 },
        { pattern: 'instead of paying', weight: 3 },
        // Replacement effects (very creative)
        { pattern: 'if you would', weight: 4 },
        { pattern: 'instead', weight: 2 },
        { pattern: 'rather than', weight: 2 },
        // Cost manipulation (creative)
        { pattern: 'costs {x} less', weight: 3 },
        { pattern: 'cost less', weight: 2 },
        { pattern: 'reduce the cost', weight: 2 },
        // X-cost shenanigans (very creative)
        { pattern: 'x is', weight: 3 },
        { pattern: 'where x', weight: 3 },
        { pattern: 'for each', weight: 2 },
        // Graveyard/Exile tricks (creative)
        { pattern: 'from your graveyard', weight: 2 },
        { pattern: 'from exile', weight: 3 },
        { pattern: 'suspended', weight: 4 },
        { pattern: 'flashback', weight: 2 },
        // Timing manipulation (very creative)
        { pattern: 'split second', weight: 4 },
        { pattern: 'can\'t be countered', weight: 2 },
        { pattern: 'flash', weight: 1 },
        { pattern: 'as though', weight: 3 },
        // Resource doubling (creative)
        { pattern: 'double', weight: 2 },
        { pattern: 'additional', weight: 1 },
        { pattern: 'copy', weight: 2 },
        // State manipulation (very creative)
        { pattern: 'enters with', weight: 2 },
        { pattern: 'persistent', weight: 3 },
        { pattern: 'phase out', weight: 4 },
        // Obscure mechanics (highest creativity)
        { pattern: 'cascade', weight: 3 },
        { pattern: 'storm', weight: 4 },
        { pattern: 'affinity', weight: 3 },
        { pattern: 'delve', weight: 3 },
        { pattern: 'convoke', weight: 2 },
        { pattern: 'improvise', weight: 3 }
      ]

      const creativityScore = creativityIndicators.reduce((score, indicator) => {
        return score + (text.includes(indicator.pattern) ? indicator.weight : 0)
      }, 0)

      // Require minimum creativity threshold
      if (creativityScore < 2) return false

      // Obscurity bonus for old sets or rare cards
      const obscurityBonus = calculateObscurityBonus(card, includeObscure)
      
      return (creativityScore + obscurityBonus) >= 2

    } catch (e) {
      return false
    }
  })
}

function calculateObscurityBonus(card: Card, includeObscure: boolean): number {
  if (!includeObscure) return 0
  
  let bonus = 0
  
  // Old set bonus
  const oldSets = ['mir', 'tmp', 'usg', 'mmq', 'inv', 'ody', 'ons', 'mrd', 'chk', 'rav']
  if (card.set_code && oldSets.some(set => card.set_code?.toLowerCase().includes(set))) {
    bonus += 2
  }
  
  // Rarity bonus for creative potential
  if (card.rarity === 'rare') bonus += 1
  if (card.rarity === 'mythic') bonus += 1
  
  return bonus
}

async function discoverCreativeCombos(
  cards: Card[], 
  colors: string[], 
  format: string,
  creativityLevel: string,
  maxPieces: number,
  minPowerLevel: number
): Promise<CreativeCombo[]> {
  
  const discoveries: CreativeCombo[] = []

  // Method 1: Alternative Cost Chains
  const altCostCombos = findAlternativeCostChains(cards, format)
  discoveries.push(...altCostCombos)

  // Method 2: Replacement Effect Loops
  const replacementCombos = findReplacementEffectLoops(cards, format)
  discoveries.push(...replacementCombos)

  // Method 3: Resource Multiplication Networks
  const resourceCombos = findResourceMultiplicationNetworks(cards, format)
  discoveries.push(...resourceCombos)

  // Method 4: Timing Window Exploitation
  const timingCombos = findTimingWindowExploits(cards, format)
  discoveries.push(...timingCombos)

  // Method 5: State-Based Action Manipulation
  const stateCombos = findStateBasedManipulation(cards, format)
  discoveries.push(...stateCombos)

  // Method 6: Cross-Mechanical Synergies
  const crossCombos = findCrossMechanicalSynergies(cards, format)
  discoveries.push(...crossCombos)

  return discoveries.filter(combo => 
    combo.power_level >= minPowerLevel &&
    combo.cards.length <= maxPieces &&
    meetsCreativityThreshold(combo, creativityLevel)
  )
}

function findAlternativeCostChains(cards: Card[], format: string): CreativeCombo[] {
  const combos: CreativeCombo[] = []
  
  const altCostCards = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('without paying') || 
           text.includes('alternative cost') ||
           text.includes('instead of paying')
  })

  const enablers = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return (text.includes('cast') && text.includes('from')) ||
           text.includes('cost') && text.includes('less')
  })

  altCostCards.forEach(altCard => {
    enablers.forEach(enabler => {
      if (altCard.id !== enabler.id && canInteract(altCard, enabler)) {
        const combo: CreativeCombo = {
          id: `alt_cost_${altCard.id}_${enabler.id}`,
          cards: [altCard, enabler],
          category: 'alternative_cost_exploitation',
          creativity_score: 8,
          obscurity_level: 'obscure',
          description: `Combo Costo Alternativo: ${enabler.name} + ${altCard.name}`,
          explanation: [
            `${enabler.name} permette di lanciare ${altCard.name} senza pagare il costo di mana`,
            `Questo crea un vantaggio di mana significativo per effetti potenti`,
            `La combo sfrutta meccaniche alternative di pagamento raramente viste`
          ],
          setup_steps: [
            `Metti in campo ${enabler.name}`,
            `Attiva l'abilità per lanciare ${altCard.name} gratis`,
            `Sfrutta l'effetto potente senza pagare il costo normale`
          ],
          timing_requirements: [
            'Richiede timing preciso per massimizzare il vantaggio',
            'Considera stack interactions per evitare disruption'
          ],
          rules_interactions: [
            'Alternative cost rules (CR 118.9)',
            'Cost reduction interactions',
            'Timing restrictions bypass'
          ],
          power_level: calculatePowerLevel(altCard, enabler),
          consistency: calculateConsistency([altCard, enabler]),
          discovery_method: 'alternative_cost_chain',
          format_legal: getFormatLegality([altCard, enabler])
        }
        combos.push(combo)
      }
    })
  })

  return combos
}

function findReplacementEffectLoops(cards: Card[], format: string): CreativeCombo[] {
  const combos: CreativeCombo[] = []
  
  const replacementCards = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('if you would') || 
           text.includes('instead') ||
           text.includes('replacement effect')
  })

  // Create chains of replacement effects
  for (let i = 0; i < replacementCards.length; i++) {
    for (let j = i + 1; j < replacementCards.length; j++) {
      const card1 = replacementCards[i]
      const card2 = replacementCards[j]
      
      if (canCreateReplacementLoop(card1, card2)) {
        const combo: CreativeCombo = {
          id: `replacement_loop_${card1.id}_${card2.id}`,
          cards: [card1, card2],
          category: 'replacement_effect_loop',
          creativity_score: 9,
          obscurity_level: 'hidden',
          description: `Loop Effetti Sostituzione: ${card1.name} + ${card2.name}`,
          explanation: [
            `${card1.name} e ${card2.name} creano un loop di effetti sostituzione`,
            `Ogni effetto sostituisce l'azione normale con qualcosa di vantaggioso`,
            `Il loop può essere ripetuto per vantaggio illimitato`
          ],
          setup_steps: [
            `Metti in campo entrambe le carte`,
            `Innesca la prima sostituzione`,
            `Lascia che il loop si perpetui automaticamente`
          ],
          timing_requirements: [
            'Replacement effects non usano la stack',
            'Si applicano immediatamente quando la condizione è soddisfatta'
          ],
          rules_interactions: [
            'Replacement effect rules (CR 614)',
            'Layering system interactions',
            'Infinite loop handling'
          ],
          power_level: Math.min(10, calculatePowerLevel(card1, card2) + 2),
          consistency: calculateConsistency([card1, card2]) - 1,
          discovery_method: 'replacement_effect_loop',
          format_legal: getFormatLegality([card1, card2])
        }
        combos.push(combo)
      }
    }
  }

  return combos
}

function findResourceMultiplicationNetworks(cards: Card[], format: string): CreativeCombo[] {
  const combos: CreativeCombo[] = []
  
  const multipliers = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('double') || 
           text.includes('additional') ||
           text.includes('extra') ||
           text.includes('twice')
  })

  const generators = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('create') ||
           text.includes('add') ||
           text.includes('generate') ||
           text.includes('produce')
  })

  multipliers.forEach(multiplier => {
    generators.forEach(generator => {
      if (multiplier.id !== generator.id && resourceTypesMatch(multiplier, generator)) {
        const combo: CreativeCombo = {
          id: `resource_multiply_${multiplier.id}_${generator.id}`,
          cards: [multiplier, generator],
          category: 'resource_multiplication',
          creativity_score: 7,
          obscurity_level: 'rare',
          description: `Moltiplicatore Risorse: ${generator.name} + ${multiplier.name}`,
          explanation: [
            `${generator.name} genera risorse base`,
            `${multiplier.name} raddoppia o moltiplica queste risorse`,
            `Il risultato è un engine di generazione accelerata`
          ],
          setup_steps: [
            `Stabilisci ${generator.name} come generatore base`,
            `Attiva ${multiplier.name} per moltiplicare output`,
            `Scala rapidamente il vantaggio di risorse`
          ],
          timing_requirements: [
            'Coordina l\'attivazione per massimo beneficio',
            'Proteggi il network da disruption'
          ],
          rules_interactions: [
            'Resource generation timing',
            'Multiplication effect stacking',
            'Permanent interaction rules'
          ],
          power_level: calculatePowerLevel(multiplier, generator),
          consistency: calculateConsistency([multiplier, generator]),
          discovery_method: 'resource_multiplication_network',
          format_legal: getFormatLegality([multiplier, generator])
        }
        combos.push(combo)
      }
    })
  })

  return combos
}

function findTimingWindowExploits(cards: Card[], format: string): CreativeCombo[] {
  const combos: CreativeCombo[] = []
  
  const timingCards = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('split second') ||
           text.includes('can\'t be countered') ||
           text.includes('flash') ||
           text.includes('at the beginning') ||
           text.includes('end step')
  })

  const protectedCards = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('hexproof') ||
           text.includes('protection') ||
           text.includes('shroud') ||
           text.includes('ward')
  })

  timingCards.forEach(timing => {
    protectedCards.forEach(protection => {
      if (timing.id !== protection.id) {
        const combo: CreativeCombo = {
          id: `timing_exploit_${timing.id}_${protection.id}`,
          cards: [timing, protection],
          category: 'timing_window_exploitation',
          creativity_score: 6,
          obscurity_level: 'obscure',
          description: `Exploit Timing: ${timing.name} + ${protection.name}`,
          explanation: [
            `${timing.name} crea una finestra di timing protetta`,
            `${protection.name} fornisce protezione aggiuntiva`,
            `La combinazione rende le azioni quasi impossibili da contrastare`
          ],
          setup_steps: [
            `Prepara ${protection.name} per protezione`,
            `Attiva ${timing.name} nella finestra ottimale`,
            `Esegui le azioni critiche in sicurezza`
          ],
          timing_requirements: [
            'Timing preciso per massima efficacia',
            'Considera response windows dell\'avversario'
          ],
          rules_interactions: [
            'Priority and timing rules',
            'Protection interaction rules',
            'Stack timing windows'
          ],
          power_level: calculatePowerLevel(timing, protection),
          consistency: calculateConsistency([timing, protection]),
          discovery_method: 'timing_window_exploitation',
          format_legal: getFormatLegality([timing, protection])
        }
        combos.push(combo)
      }
    })
  })

  return combos
}

function findStateBasedManipulation(cards: Card[], format: string): CreativeCombo[] {
  const combos: CreativeCombo[] = []
  
  const stateCards = cards.filter(card => {
    const text = (card.oracle_text || '').toLowerCase()
    return text.includes('enters with') ||
           text.includes('persistent') ||
           text.includes('phase out') ||
           text.includes('state-based')
  })

  // Find 3-card state manipulation combos
  for (let i = 0; i < stateCards.length; i++) {
    for (let j = i + 1; j < stateCards.length; j++) {
      for (let k = j + 1; k < stateCards.length; k++) {
        const cards_combo = [stateCards[i], stateCards[j], stateCards[k]]
        
        if (canCreateStateLoop(cards_combo)) {
          const combo: CreativeCombo = {
            id: `state_manipulation_${cards_combo.map(c => c.id).join('_')}`,
            cards: cards_combo,
            category: 'state_based_manipulation',
            creativity_score: 10,
            obscurity_level: 'unknown',
            description: `Manipolazione Stati: ${cards_combo.map(c => c.name).join(' + ')}`,
            explanation: [
              `Le tre carte manipolano state-based actions`,
              `Creano situazioni che il gioco non riesce a risolvere normalmente`,
              `Il risultato è controllo totale del board state`
            ],
            setup_steps: [
              `Stabilisci ${cards_combo[0].name} per la base`,
              `Aggiungi ${cards_combo[1].name} per amplificare`,
              `Completa con ${cards_combo[2].name} per il lock`
            ],
            timing_requirements: [
              'State-based actions si applicano automaticamente',
              'Sequenza di setup critica per funzionamento'
            ],
            rules_interactions: [
              'State-based action rules (CR 704)',
              'Continuous effect layering',
              'Priority and state-based timing'
            ],
            power_level: 9,
            consistency: calculateConsistency(cards_combo) - 2,
            discovery_method: 'state_based_manipulation',
            format_legal: getFormatLegality(cards_combo)
          }
          combos.push(combo)
        }
      }
    }
  }

  return combos.slice(0, 5) // Limit to prevent explosion
}

function findCrossMechanicalSynergies(cards: Card[], format: string): CreativeCombo[] {
  const combos: CreativeCombo[] = []
  
  // Group cards by unique mechanics
  const mechanicGroups = groupCardsByMechanics(cards)
  
  // Find cross-mechanical interactions
  const mechanics = Object.keys(mechanicGroups)
  for (let i = 0; i < mechanics.length; i++) {
    for (let j = i + 1; j < mechanics.length; j++) {
      const mech1Cards = mechanicGroups[mechanics[i]]
      const mech2Cards = mechanicGroups[mechanics[j]]
      
      mech1Cards.slice(0, 3).forEach(card1 => {
        mech2Cards.slice(0, 3).forEach(card2 => {
          if (mechanicsHaveSynergy(mechanics[i], mechanics[j])) {
            const combo: CreativeCombo = {
              id: `cross_mech_${card1.id}_${card2.id}`,
              cards: [card1, card2],
              category: 'cross_mechanical_synergy',
              creativity_score: 7,
              obscurity_level: 'rare',
              description: `Sinergia Cross-Meccaniche: ${mechanics[i]} + ${mechanics[j]}`,
              explanation: [
                `${card1.name} usa la meccanica ${mechanics[i]}`,
                `${card2.name} usa la meccanica ${mechanics[j]}`,
                `L'interazione tra meccaniche diverse crea vantaggio inaspettato`
              ],
              setup_steps: [
                `Attiva ${card1.name} per la prima meccanica`,
                `Combina con ${card2.name} per la seconda meccanica`,
                `Sfrutta l'interazione sinergica risultante`
              ],
              timing_requirements: [
                'Coordinate mechanical interactions for optimal effect'
              ],
              rules_interactions: [
                `${mechanics[i]} rules interactions`,
                `${mechanics[j]} rules interactions`,
                'Cross-mechanical synergy timing'
              ],
              power_level: calculatePowerLevel(card1, card2),
              consistency: calculateConsistency([card1, card2]),
              discovery_method: 'cross_mechanical_synergy',
              format_legal: getFormatLegality([card1, card2])
            }
            combos.push(combo)
          }
        })
      })
    }
  }

  return combos.slice(0, 10) // Limit results
}

// Helper functions
function canInteract(card1: Card, card2: Card): boolean {
  const text1 = (card1.oracle_text || '').toLowerCase()
  const text2 = (card2.oracle_text || '').toLowerCase()
  
  return text1.includes('cast') || text2.includes('cast') ||
         text1.includes('mana') || text2.includes('mana')
}

function canCreateReplacementLoop(card1: Card, card2: Card): boolean {
  const text1 = (card1.oracle_text || '').toLowerCase()
  const text2 = (card2.oracle_text || '').toLowerCase()
  
  return (text1.includes('if you would') && text2.includes('instead')) ||
         (text1.includes('instead') && text2.includes('if you would'))
}

function resourceTypesMatch(multiplier: Card, generator: Card): boolean {
  const multText = (multiplier.oracle_text || '').toLowerCase()
  const genText = (generator.oracle_text || '').toLowerCase()
  
  const resources = ['mana', 'token', 'card', 'counter', 'life']
  return resources.some(resource => 
    multText.includes(resource) && genText.includes(resource)
  )
}

function canCreateStateLoop(cards: Card[]): boolean {
  return cards.length >= 3 && cards.some(card => 
    (card.oracle_text || '').toLowerCase().includes('state') ||
    (card.oracle_text || '').toLowerCase().includes('phase')
  )
}

function groupCardsByMechanics(cards: Card[]): {[key: string]: Card[]} {
  const mechanics = [
    'cascade', 'storm', 'affinity', 'delve', 'convoke', 'improvise',
    'flashback', 'madness', 'threshold', 'metalcraft', 'delirium',
    'energy', 'experience', 'investigate', 'proliferate', 'scry'
  ]
  
  const groups: {[key: string]: Card[]} = {}
  
  mechanics.forEach(mechanic => {
    groups[mechanic] = cards.filter(card => 
      (card.oracle_text || '').toLowerCase().includes(mechanic)
    )
  })
  
  return groups
}

function mechanicsHaveSynergy(mech1: string, mech2: string): boolean {
  const synergyPairs = [
    ['storm', 'cascade'], ['affinity', 'improvise'], ['delve', 'threshold'],
    ['energy', 'proliferate'], ['madness', 'threshold'], ['scry', 'cascade']
  ]
  
  return synergyPairs.some(pair => 
    (pair[0] === mech1 && pair[1] === mech2) ||
    (pair[0] === mech2 && pair[1] === mech1)
  )
}

function calculatePowerLevel(card1: Card, card2: Card): number {
  const avgManaValue = ((card1.mana_value || 0) + (card2.mana_value || 0)) / 2
  const baseRarityScore = (card1.rarity === 'mythic' || card2.rarity === 'mythic') ? 2 : 
                         (card1.rarity === 'rare' || card2.rarity === 'rare') ? 1 : 0
  
  return Math.max(1, Math.min(10, Math.floor(8 - avgManaValue / 2 + baseRarityScore)))
}

function calculateConsistency(cards: Card[]): number {
  const avgManaValue = cards.reduce((sum, card) => sum + (card.mana_value || 0), 0) / cards.length
  const colorCount = new Set(cards.flatMap(card => card.color_identity || [])).size
  
  return Math.max(1, Math.min(10, Math.floor(8 - avgManaValue / 3 - colorCount / 2)))
}

function getFormatLegality(cards: Card[]): string[] {
  const formats = []
  if (cards.every(card => card.legal_standard)) formats.push('standard')
  if (cards.every(card => card.legal_historic)) formats.push('historic')
  if (cards.every(card => card.legal_brawl)) formats.push('brawl')
  return formats
}

function meetsCreativityThreshold(combo: CreativeCombo, level: string): boolean {
  const thresholds = { low: 4, medium: 6, high: 8 }
  return combo.creativity_score >= thresholds[level as keyof typeof thresholds]
}

function getObscurityStats(combos: CreativeCombo[]): {[key: string]: number} {
  const stats: {[key: string]: number} = {}
  combos.forEach(combo => {
    stats[combo.obscurity_level] = (stats[combo.obscurity_level] || 0) + 1
  })
  return stats
}

function getFormatCoverage(combos: CreativeCombo[]): {[key: string]: number} {
  const coverage: {[key: string]: number} = {}
  combos.forEach(combo => {
    combo.format_legal.forEach(format => {
      coverage[format] = (coverage[format] || 0) + 1
    })
  })
  return coverage
}