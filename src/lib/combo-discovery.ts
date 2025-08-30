// src/lib/combo-discovery.ts
// Motore di scoperta combo - trova sinergie non documentate tra carte MTG Arena

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface Card {
  id: string
  scryfall_id: string
  name: string
  name_it?: string
  mana_value: number
  mana_cost: string
  colors: string[]
  color_identity: string[]
  types: string[]
  subtypes: string[]
  oracle_text: string
  legal_standard: boolean
  legal_historic: boolean
  legal_brawl: boolean
  tags: string[]
  produces_colors?: string[]
}

interface ComboPattern {
  type: 'infinite_mana' | 'infinite_cards' | 'infinite_damage' | 'infinite_life' | 'value_engine' | 'lock' | 'synergy'
  cards: string[]
  steps: string[]
  requirements: string[]
  power_level: number
  consistency: number
  mana_cost: number
  colors_required: string[]
}

interface TriggerPattern {
  card_id: string
  trigger_type: 'etb' | 'dies' | 'cast' | 'tap' | 'untap' | 'attack' | 'damage' | 'lifegain' | 'sacrifice' | 'discard'
  condition?: string
  effect: string
  cost?: string
}

interface EnablerPattern {
  card_id: string
  enables: string[]
  cost: string
  repeatable: boolean
}

export class ComboDiscoveryEngine {
  private supabase
  private cards: Card[] = []
  private triggers: TriggerPattern[] = []
  private enablers: EnablerPattern[] = []

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  }

  async initialize(format: 'standard' | 'historic' | 'brawl' = 'standard') {
    console.log('Inizializing Combo Discovery Engine...')
    
    // Carica carte legali per il formato
    const { data: cards, error } = await this.supabase
      .from('cards')
      .select('*')
      .eq('in_arena', true)
      .eq(format === 'standard' ? 'legal_standard' : format === 'historic' ? 'legal_historic' : 'legal_brawl', true)
    
    if (error) {
      throw new Error(`Errore caricamento carte: ${error.message}`)
    }

    this.cards = cards || []
    console.log(`Caricate ${this.cards.length} carte per formato ${format}`)

    // Analizza pattern di trigger ed enabler
    await this.analyzeCardPatterns()
    console.log(`Identificati ${this.triggers.length} trigger e ${this.enablers.length} enabler`)
  }

  private async analyzeCardPatterns() {
    this.triggers = []
    this.enablers = []

    for (const card of this.cards) {
      const triggers = this.extractTriggers(card)
      const enablers = this.extractEnablers(card)
      
      this.triggers.push(...triggers)
      this.enablers.push(...enablers)
    }
  }

  private extractTriggers(card: Card): TriggerPattern[] {
    const text = card.oracle_text.toLowerCase()
    const triggers: TriggerPattern[] = []

    // Pattern ETB (Enters the Battlefield)
    if (text.includes('enters the battlefield') || text.includes('enters') && text.includes('battlefield')) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'etb',
        effect: this.extractEffect(text, 'enters the battlefield')
      })
    }

    // Pattern Dies
    if (text.includes('dies') || text.includes('is put into a graveyard')) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'dies',
        effect: this.extractEffect(text, 'dies')
      })
    }

    // Pattern Cast
    if (text.includes('whenever you cast') || text.includes('when you cast')) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'cast',
        condition: this.extractCondition(text, 'cast'),
        effect: this.extractEffect(text, 'cast')
      })
    }

    // Pattern Tap/Untap
    if (text.includes('tap') && (text.includes('add') || text.includes('deal') || text.includes('draw'))) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'tap',
        effect: this.extractEffect(text, 'tap'),
        cost: this.extractTapCost(text)
      })
    }

    // Pattern Attack
    if (text.includes('whenever') && text.includes('attack')) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'attack',
        effect: this.extractEffect(text, 'attack')
      })
    }

    // Pattern Damage
    if (text.includes('damage') && (text.includes('whenever') || text.includes('when'))) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'damage',
        effect: this.extractEffect(text, 'damage')
      })
    }

    // Pattern Lifegain
    if (text.includes('gain life') && (text.includes('whenever') || text.includes('when'))) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'lifegain',
        effect: this.extractEffect(text, 'gain life')
      })
    }

    // Pattern Sacrifice
    if (text.includes('sacrifice') && (text.includes('whenever') || text.includes('when'))) {
      triggers.push({
        card_id: card.id,
        trigger_type: 'sacrifice',
        effect: this.extractEffect(text, 'sacrifice')
      })
    }

    return triggers
  }

  private extractEnablers(card: Card): EnablerPattern[] {
    const text = card.oracle_text.toLowerCase()
    const enablers: EnablerPattern[] = []

    // Enabler di Untap
    if (text.includes('untap') && !text.includes("doesn't untap")) {
      enablers.push({
        card_id: card.id,
        enables: ['untap'],
        cost: this.extractActivationCost(text, 'untap'),
        repeatable: text.includes('activate') || text.includes('ability')
      })
    }

    // Enabler di Bounce/Flicker
    if (text.includes('return') && (text.includes('hand') || text.includes('battlefield'))) {
      enablers.push({
        card_id: card.id,
        enables: ['bounce', 'flicker'],
        cost: this.extractActivationCost(text, 'return'),
        repeatable: text.includes('activate') || !text.includes('enters the battlefield')
      })
    }

    // Enabler di Sacrifice
    if (text.includes('sacrifice') && text.includes(':')) {
      enablers.push({
        card_id: card.id,
        enables: ['sacrifice'],
        cost: this.extractActivationCost(text, 'sacrifice'),
        repeatable: true
      })
    }

    // Enabler di Token Creation
    if (text.includes('create') && text.includes('token')) {
      enablers.push({
        card_id: card.id,
        enables: ['tokens'],
        cost: this.extractActivationCost(text, 'create'),
        repeatable: text.includes('activate') || text.includes('whenever')
      })
    }

    // Enabler di Mana Production
    if (text.includes('add') && text.includes('mana')) {
      enablers.push({
        card_id: card.id,
        enables: ['mana'],
        cost: this.extractActivationCost(text, 'add'),
        repeatable: true
      })
    }

    return enablers
  }

  private extractEffect(text: string, trigger: string): string {
    // Estrae l'effetto che segue il trigger
    const triggerIndex = text.indexOf(trigger)
    if (triggerIndex === -1) return ''
    
    const afterTrigger = text.substring(triggerIndex + trigger.length)
    const sentences = afterTrigger.split('.')
    return sentences[0]?.trim() || ''
  }

  private extractCondition(text: string, trigger: string): string {
    const pattern = new RegExp(`whenever you cast.*?${trigger}.*?(spell|creature|artifact|enchantment|instant|sorcery)`, 'i')
    const match = text.match(pattern)
    return match ? match[1] : ''
  }

  private extractTapCost(text: string): string {
    const tapMatch = text.match(/\{([^}]*t[^}]*)\}/i)
    return tapMatch ? tapMatch[1] : '{T}'
  }

  private extractActivationCost(text: string, effect: string): string {
    // Cerca pattern come "{cost}: effect"
    const costPattern = new RegExp(`\\{([^}]*)\\}:.*${effect}`, 'i')
    const match = text.match(costPattern)
    return match ? `{${match[1]}}` : ''
  }

  async discoverCombosFromCards(seedCardIds: string[], format: 'standard' | 'historic' | 'brawl' = 'standard'): Promise<ComboPattern[]> {
    if (!this.cards.length) {
      await this.initialize(format)
    }

    const seedCards = this.cards.filter(card => seedCardIds.includes(card.id))
    const combos: ComboPattern[] = []

    console.log(`Analizzando combo da ${seedCards.length} carte seed...`)

    // Trova combo tra le carte seed
    for (let i = 0; i < seedCards.length; i++) {
      for (let j = i + 1; j < seedCards.length; j++) {
        const combo = await this.analyzeCardPair(seedCards[i], seedCards[j])
        if (combo) combos.push(combo)
      }
    }

    // Trova carte che completano le combo seed
    for (const seedCard of seedCards) {
      const completingCombos = await this.findComboCompletions(seedCard, seedCardIds)
      combos.push(...completingCombos)
    }

    // Elimina duplicati e ordina per power level
    const uniqueCombos = this.deduplicateCombos(combos)
    return uniqueCombos.sort((a, b) => b.power_level - a.power_level).slice(0, 20)
  }

  private async analyzeCardPair(card1: Card, card2: Card): Promise<ComboPattern | null> {
    const triggers1 = this.triggers.filter(t => t.card_id === card1.id)
    const triggers2 = this.triggers.filter(t => t.card_id === card2.id)
    const enablers1 = this.enablers.filter(e => e.card_id === card1.id)
    const enablers2 = this.enablers.filter(e => e.card_id === card2.id)

    // Check per combo infinite
    for (const trigger of triggers1) {
      for (const enabler of enablers2) {
        if (this.canCreateInfiniteLoop(trigger, enabler, card1, card2)) {
          return this.buildComboPattern([card1, card2], trigger, enabler)
        }
      }
    }

    for (const trigger of triggers2) {
      for (const enabler of enablers1) {
        if (this.canCreateInfiniteLoop(trigger, enabler, card2, card1)) {
          return this.buildComboPattern([card1, card2], trigger, enabler)
        }
      }
    }

    // Check per value engine
    const valueCombo = this.checkValueEngine(card1, card2, triggers1.concat(triggers2), enablers1.concat(enablers2))
    if (valueCombo) return valueCombo

    return null
  }

  private canCreateInfiniteLoop(trigger: TriggerPattern, enabler: EnablerPattern, triggerCard: Card, enablerCard: Card): boolean {
    // ETB + Bounce/Flicker = Infinite ETB
    if (trigger.trigger_type === 'etb' && enabler.enables.includes('bounce')) {
      return trigger.effect.includes('add') || trigger.effect.includes('deal') || trigger.effect.includes('draw') || trigger.effect.includes('create')
    }

    // Dies + Sacrifice = Infinite Dies (se genera tokens)
    if (trigger.trigger_type === 'dies' && enabler.enables.includes('sacrifice')) {
      return trigger.effect.includes('create') && trigger.effect.includes('token')
    }

    // Tap + Untap = Infinite activations
    if (trigger.trigger_type === 'tap' && enabler.enables.includes('untap')) {
      return trigger.effect.includes('add') || trigger.effect.includes('deal') || trigger.effect.includes('draw')
    }

    // Cast + Cost reduction/Free spells
    if (trigger.trigger_type === 'cast' && enablerCard.oracle_text.toLowerCase().includes('without paying')) {
      return true
    }

    return false
  }

  private buildComboPattern(cards: Card[], trigger: TriggerPattern, enabler: EnablerPattern): ComboPattern {
    const triggerCard = cards.find(c => c.id === trigger.card_id)!
    const enablerCard = cards.find(c => c.id === enabler.card_id)!

    const steps: string[] = []
    const requirements: string[] = []
    let type: ComboPattern['type'] = 'synergy'
    let powerLevel = 5

    if (trigger.trigger_type === 'etb' && enabler.enables.includes('bounce')) {
      type = trigger.effect.includes('add') ? 'infinite_mana' : 
            trigger.effect.includes('deal') ? 'infinite_damage' :
            trigger.effect.includes('draw') ? 'infinite_cards' : 'value_engine'
      
      steps.push(`1. Gioca ${triggerCard.name_it || triggerCard.name}`)
      steps.push(`2. Attiva ${enablerCard.name_it || enablerCard.name} per rimbalzare ${triggerCard.name_it || triggerCard.name}`)
      steps.push(`3. Rigioca ${triggerCard.name_it || triggerCard.name}`)
      steps.push(`4. Ripeti per infinite volte`)
      
      powerLevel = 8
      requirements.push(`Mana sufficiente per ciclo: ${triggerCard.mana_value + (enabler.cost ? 1 : 0)}`)
    }

    if (trigger.trigger_type === 'tap' && enabler.enables.includes('untap')) {
      type = trigger.effect.includes('add') ? 'infinite_mana' : 'infinite_damage'
      
      steps.push(`1. TAPpa ${triggerCard.name_it || triggerCard.name}`)
      steps.push(`2. Attiva ${enablerCard.name_it || enablerCard.name} per STAPpare ${triggerCard.name_it || triggerCard.name}`)
      steps.push(`3. Ripeti infinite volte`)
      
      powerLevel = 9
    }

    return {
      type,
      cards: cards.map(c => c.id),
      steps,
      requirements,
      power_level: powerLevel,
      consistency: this.calculateConsistency(cards),
      mana_cost: cards.reduce((sum, c) => sum + c.mana_value, 0),
      colors_required: [...new Set(cards.flatMap(c => c.color_identity))]
    }
  }

  private checkValueEngine(card1: Card, card2: Card, triggers: TriggerPattern[], enablers: EnablerPattern[]): ComboPattern | null {
    // Cerca sinergie che generano vantaggio progressivo
    for (const trigger of triggers) {
      if (trigger.effect.includes('draw') || trigger.effect.includes('create') || trigger.effect.includes('search')) {
        for (const enabler of enablers) {
          if (enabler.repeatable && trigger.card_id !== enabler.card_id) {
            return {
              type: 'value_engine',
              cards: [card1.id, card2.id],
              steps: [
                `1. Stabilisci ${card1.name_it || card1.name} e ${card2.name_it || card2.name}`,
                `2. Attiva ripetutamente per vantaggio carte/board`
              ],
              requirements: ['Setup iniziale stabile'],
              power_level: 6,
              consistency: this.calculateConsistency([card1, card2]),
              mana_cost: card1.mana_value + card2.mana_value,
              colors_required: [...new Set([...card1.color_identity, ...card2.color_identity])]
            }
          }
        }
      }
    }

    return null
  }

  private async findComboCompletions(seedCard: Card, excludeIds: string[]): Promise<ComboPattern[]> {
    const completions: ComboPattern[] = []
    const seedTriggers = this.triggers.filter(t => t.card_id === seedCard.id)
    const seedEnablers = this.enablers.filter(e => e.card_id === seedCard.id)

    // Cerca carte che completano i trigger della seed card
    for (const trigger of seedTriggers) {
      const matchingEnablers = this.enablers.filter(e => 
        !excludeIds.includes(e.card_id) && 
        this.triggersMatch(trigger, e)
      )

      for (const enabler of matchingEnablers.slice(0, 5)) { // Limita a 5 per performance
        const enablerCard = this.cards.find(c => c.id === enabler.card_id)
        if (enablerCard) {
          const combo = this.buildComboPattern([seedCard, enablerCard], trigger, enabler)
          completions.push(combo)
        }
      }
    }

    // Cerca carte che completano gli enabler della seed card  
    for (const enabler of seedEnablers) {
      const matchingTriggers = this.triggers.filter(t => 
        !excludeIds.includes(t.card_id) &&
        this.triggersMatch(t, enabler)
      )

      for (const trigger of matchingTriggers.slice(0, 5)) {
        const triggerCard = this.cards.find(c => c.id === trigger.card_id)
        if (triggerCard) {
          const combo = this.buildComboPattern([seedCard, triggerCard], trigger, enabler)
          completions.push(combo)
        }
      }
    }

    return completions
  }

  private triggersMatch(trigger: TriggerPattern, enabler: EnablerPattern): boolean {
    if (trigger.trigger_type === 'etb' && enabler.enables.includes('bounce')) return true
    if (trigger.trigger_type === 'dies' && enabler.enables.includes('sacrifice')) return true  
    if (trigger.trigger_type === 'tap' && enabler.enables.includes('untap')) return true
    return false
  }

  private calculateConsistency(cards: Card[]): number {
    // Calcola consistenza basata su CMC, requisiti colore, tipo di carta
    let consistency = 10

    // Penalità per CMC alto
    const avgCmc = cards.reduce((sum, c) => sum + c.mana_value, 0) / cards.length
    if (avgCmc > 4) consistency -= 2
    if (avgCmc > 6) consistency -= 2

    // Penalità per molti colori
    const totalColors = new Set(cards.flatMap(c => c.color_identity)).size
    if (totalColors > 2) consistency -= 1
    if (totalColors > 3) consistency -= 2

    // Bonus per creatures (più facili da cercare/giocare)
    const hasCreatures = cards.some(c => c.types.includes('Creature'))
    if (hasCreatures) consistency += 1

    return Math.max(1, consistency)
  }

  private deduplicateCombos(combos: ComboPattern[]): ComboPattern[] {
    const seen = new Set<string>()
    return combos.filter(combo => {
      const key = combo.cards.sort().join('-') + combo.type
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // Metodo pubblico per trovare sinergie tra carte specifiche
  async findSynergiesBetweenCards(cardIds: string[]): Promise<{synergies: any[], explanations: string[]}> {
    const cards = this.cards.filter(c => cardIds.includes(c.id))
    const synergies = []
    const explanations = []

    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const synergy = await this.analyzeCardPair(cards[i], cards[j])
        if (synergy) {
          synergies.push(synergy)
          explanations.push(`${cards[i].name} + ${cards[j].name}: ${synergy.type} combo`)
        }
      }
    }

    return { synergies, explanations }
  }

  // Metodo per cercare combo per archetipi
  async discoverCombosByArchetype(colors: string[], archetype: string, format: 'standard' | 'historic' | 'brawl' = 'standard'): Promise<ComboPattern[]> {
    if (!this.cards.length) {
      await this.initialize(format)
    }

    const relevantCards = this.cards.filter(card => {
      const hasColor = colors.length === 0 || card.color_identity.some(c => colors.includes(c))
      const matchesArchetype = this.cardMatchesArchetype(card, archetype)
      return hasColor && matchesArchetype
    })

    console.log(`Trovate ${relevantCards.length} carte rilevanti per ${archetype} in colori ${colors.join('')}`)

    const combos: ComboPattern[] = []
    
    // Analizza tutte le coppie (limitato a 1000 per performance)
    const maxPairs = Math.min(relevantCards.length, 50)
    for (let i = 0; i < maxPairs; i++) {
      for (let j = i + 1; j < maxPairs; j++) {
        const combo = await this.analyzeCardPair(relevantCards[i], relevantCards[j])
        if (combo) combos.push(combo)
      }
    }

    return this.deduplicateCombos(combos)
      .sort((a, b) => b.power_level - a.power_level)
      .slice(0, 15)
  }

  private cardMatchesArchetype(card: Card, archetype: string): boolean {
    const text = card.oracle_text.toLowerCase()
    const name = card.name.toLowerCase()

    switch (archetype.toLowerCase()) {
      case 'lifegain':
        return text.includes('gain life') || text.includes('lifegain') || card.tags.includes('lifegain')
      case 'artifacts':
        return card.types.includes('Artifact') || text.includes('artifact') || card.tags.includes('artifacts')
      case 'spells':
        return text.includes('instant') || text.includes('sorcery') || text.includes('noncreature spell')
      case 'tokens':
        return text.includes('create') && text.includes('token')
      case 'sacrifice':
        return text.includes('sacrifice') || card.tags.includes('sacrifice')
      case 'graveyard':
        return text.includes('graveyard') || text.includes('exile') && text.includes('graveyard')
      case 'counters':
        return text.includes('+1/+1') || text.includes('counter') && !text.includes('counter target')
      default:
        return card.tags.includes(archetype.toLowerCase())
    }
  }
}