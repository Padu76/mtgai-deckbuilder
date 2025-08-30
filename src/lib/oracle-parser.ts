// src/lib/oracle-parser.ts
// Parser avanzato per testi Oracle delle carte MTG - estrae pattern e meccaniche

export interface ParsedAbility {
  type: 'triggered' | 'activated' | 'static' | 'replacement'
  trigger?: string
  condition?: string
  cost?: string
  effect: string
  timing?: string
  targets?: string
  optional: boolean
}

export interface CardPattern {
  card_id: string
  abilities: ParsedAbility[]
  keywords: string[]
  mechanics: string[]
  synergy_tags: string[]
  interaction_potential: number
}

export class OracleTextParser {
  private static keywordAbilities = [
    'flying', 'trample', 'vigilance', 'haste', 'first strike', 'double strike',
    'deathtouch', 'lifelink', 'hexproof', 'indestructible', 'menace',
    'reach', 'defender', 'flash', 'protection', 'ward', 'prowess'
  ]

  private static mechanicPatterns = [
    { name: 'etb', pattern: /enters the battlefield/i },
    { name: 'dies', pattern: /dies|is put into.*graveyard/i },
    { name: 'cast_trigger', pattern: /whenever.*cast/i },
    { name: 'tap_ability', pattern: /\{[^}]*t[^}]*\}:/i },
    { name: 'sacrifice', pattern: /sacrifice.*:/i },
    { name: 'token_creation', pattern: /create.*token/i },
    { name: 'mana_production', pattern: /add.*mana/i },
    { name: 'card_draw', pattern: /draw.*card/i },
    { name: 'lifegain', pattern: /gain.*life/i },
    { name: 'damage_dealing', pattern: /deal.*damage/i },
    { name: 'untap', pattern: /untap/i },
    { name: 'bounce', pattern: /return.*to.*hand/i },
    { name: 'flicker', pattern: /exile.*return.*battlefield/i },
    { name: 'cost_reduction', pattern: /cost.*less|without paying/i },
    { name: 'tutor', pattern: /search.*library/i },
    { name: 'graveyard_recursion', pattern: /return.*from.*graveyard/i }
  ]

  static parseOracleText(cardId: string, oracleText: string): CardPattern {
    const abilities = this.extractAbilities(oracleText)
    const keywords = this.extractKeywords(oracleText)
    const mechanics = this.extractMechanics(oracleText)
    const synergyTags = this.generateSynergyTags(abilities, mechanics, oracleText)
    const interactionPotential = this.calculateInteractionPotential(abilities, mechanics)

    return {
      card_id: cardId,
      abilities,
      keywords,
      mechanics,
      synergy_tags: synergyTags,
      interaction_potential: interactionPotential
    }
  }

  private static extractAbilities(text: string): ParsedAbility[] {
    const abilities: ParsedAbility[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      
      // Triggered abilities
      if (/^(whenever|when|at)/i.test(trimmed)) {
        abilities.push(this.parseTriggeredAbility(trimmed))
      }
      
      // Activated abilities
      else if (/\{[^}]*\}:/i.test(trimmed)) {
        abilities.push(this.parseActivatedAbility(trimmed))
      }
      
      // Static abilities
      else if (this.isStaticAbility(trimmed)) {
        abilities.push(this.parseStaticAbility(trimmed))
      }
    }

    return abilities
  }

  private static parseTriggeredAbility(text: string): ParsedAbility {
    const triggerMatch = text.match(/^(whenever|when|at)\s+([^,]+)/i)
    const trigger = triggerMatch ? triggerMatch[2].trim() : ''
    
    const conditionMatch = text.match(/if\s+([^,]+)/i)
    const condition = conditionMatch ? conditionMatch[1].trim() : undefined

    const effect = text.replace(/^(whenever|when|at)\s+[^,]+,?\s*/i, '').trim()
    const optional = text.toLowerCase().includes('may')

    return {
      type: 'triggered',
      trigger,
      condition,
      effect,
      optional
    }
  }

  private static parseActivatedAbility(text: string): ParsedAbility {
    const costMatch = text.match(/(\{[^}]*\}(?:\s*,\s*\{[^}]*\})*)[^:]*:/i)
    const cost = costMatch ? costMatch[1] : ''

    const effect = text.replace(/^[^:]*:\s*/i, '').trim()
    const optional = true // Activated abilities are always optional

    return {
      type: 'activated',
      cost,
      effect,
      optional
    }
  }

  private static parseStaticAbility(text: string): ParsedAbility {
    return {
      type: 'static',
      effect: text.trim(),
      optional: false
    }
  }

  private static isStaticAbility(text: string): boolean {
    const staticPatterns = [
      /has\s+/i,
      /can't\s+/i,
      /doesn't\s+/i,
      /gains?\s+/i,
      /loses?\s+/i,
      /gets?\s+/i,
      /costs?\s+/i
    ]

    return staticPatterns.some(pattern => pattern.test(text))
  }

  private static extractKeywords(text: string): string[] {
    const found: string[] = []
    const lowerText = text.toLowerCase()

    for (const keyword of this.keywordAbilities) {
      if (lowerText.includes(keyword)) {
        found.push(keyword)
      }
    }

    // Extract numeric keywords like ward, protection
    const wardMatch = text.match(/ward\s+\{([^}]+)\}/i)
    if (wardMatch) found.push(`ward_${wardMatch[1]}`)

    const protectionMatch = text.match(/protection from\s+([^.,]+)/i)
    if (protectionMatch) found.push(`protection_${protectionMatch[1].trim()}`)

    return found
  }

  private static extractMechanics(text: string): string[] {
    const found: string[] = []

    for (const mechanic of this.mechanicPatterns) {
      if (mechanic.pattern.test(text)) {
        found.push(mechanic.name)
      }
    }

    return found
  }

  private static generateSynergyTags(abilities: ParsedAbility[], mechanics: string[], text: string): string[] {
    const tags: string[] = []
    const lowerText = text.toLowerCase()

    // Tag basati su meccaniche
    if (mechanics.includes('etb')) tags.push('etb_synergy')
    if (mechanics.includes('dies')) tags.push('death_synergy')
    if (mechanics.includes('token_creation')) tags.push('token_synergy')
    if (mechanics.includes('sacrifice')) tags.push('sacrifice_synergy')
    if (mechanics.includes('mana_production')) tags.push('mana_synergy')

    // Tag basati su tipi di carte menzionati
    if (lowerText.includes('artifact')) tags.push('artifact_synergy')
    if (lowerText.includes('enchantment')) tags.push('enchantment_synergy')
    if (lowerText.includes('creature')) tags.push('creature_synergy')
    if (lowerText.includes('instant') || lowerText.includes('sorcery')) tags.push('spell_synergy')

    // Tag basati su interazioni specifiche
    if (lowerText.includes('noncreature spell')) tags.push('noncreature_spell_synergy')
    if (lowerText.includes('historic')) tags.push('historic_synergy')
    if (lowerText.includes('legendary')) tags.push('legendary_synergy')

    // Tag basati su temi
    if (lowerText.includes('+1/+1 counter')) tags.push('counter_synergy')
    if (lowerText.includes('treasure')) tags.push('treasure_synergy')
    if (lowerText.includes('food')) tags.push('food_synergy')
    if (lowerText.includes('clue')) tags.push('clue_synergy')

    // Tag combo potentiali
    for (const ability of abilities) {
      if (ability.effect.toLowerCase().includes('infinite') || 
          ability.effect.toLowerCase().includes('any number')) {
        tags.push('infinite_potential')
      }
      
      if (ability.type === 'triggered' && ability.trigger?.includes('cast') && 
          ability.effect.toLowerCase().includes('copy')) {
        tags.push('copy_combo')
      }
    }

    return [...new Set(tags)] // Rimuovi duplicati
  }

  private static calculateInteractionPotential(abilities: ParsedAbility[], mechanics: string[]): number {
    let potential = 0

    // Bonus per triggered abilities (possono essere sfruttate)
    potential += abilities.filter(a => a.type === 'triggered').length * 2

    // Bonus per activated abilities (ripetibili)
    potential += abilities.filter(a => a.type === 'activated').length * 3

    // Bonus per meccaniche combo-friendly
    const comboMechanics = ['etb', 'untap', 'sacrifice', 'token_creation', 'bounce', 'flicker']
    potential += mechanics.filter(m => comboMechanics.includes(m)).length * 2

    // Bonus per meccaniche di supporto
    const supportMechanics = ['tutor', 'card_draw', 'mana_production', 'cost_reduction']
    potential += mechanics.filter(m => supportMechanics.includes(m)).length

    return Math.min(potential, 10) // Cap a 10
  }

  // Metodi di utilità per l'analisi delle combo
  static findComboTriggers(pattern: CardPattern): string[] {
    const triggers: string[] = []
    
    for (const ability of pattern.abilities) {
      if (ability.type === 'triggered' && ability.trigger) {
        triggers.push(ability.trigger)
      }
    }

    return triggers
  }

  static findComboEnablers(pattern: CardPattern): string[] {
    const enablers: string[] = []
    
    for (const ability of pattern.abilities) {
      if (ability.type === 'activated') {
        const effect = ability.effect.toLowerCase()
        if (effect.includes('untap') || effect.includes('return') || 
            effect.includes('copy') || effect.includes('create')) {
          enablers.push(ability.effect)
        }
      }
    }

    return enablers
  }

  static getInteractionTypes(pattern1: CardPattern, pattern2: CardPattern): string[] {
    const interactions: string[] = []
    
    // Check ETB + Bounce/Flicker
    const hasETB = pattern1.mechanics.includes('etb') || pattern2.mechanics.includes('etb')
    const hasBounce = pattern1.mechanics.includes('bounce') || pattern2.mechanics.includes('bounce') ||
                     pattern1.mechanics.includes('flicker') || pattern2.mechanics.includes('flicker')
    
    if (hasETB && hasBounce) interactions.push('etb_bounce_combo')

    // Check Tap + Untap
    const hasTap = pattern1.mechanics.includes('tap_ability') || pattern2.mechanics.includes('tap_ability')
    const hasUntap = pattern1.mechanics.includes('untap') || pattern2.mechanics.includes('untap')
    
    if (hasTap && hasUntap) interactions.push('tap_untap_combo')

    // Check Death + Sacrifice
    const hasDies = pattern1.mechanics.includes('dies') || pattern2.mechanics.includes('dies')
    const hasSacrifice = pattern1.mechanics.includes('sacrifice') || pattern2.mechanics.includes('sacrifice')
    
    if (hasDies && hasSacrifice) interactions.push('death_sacrifice_combo')

    // Check Token + Sacrifice
    const hasTokens = pattern1.mechanics.includes('token_creation') || pattern2.mechanics.includes('token_creation')
    
    if (hasTokens && hasSacrifice) interactions.push('token_sacrifice_combo')

    return interactions
  }
}