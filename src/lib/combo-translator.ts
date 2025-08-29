// src/lib/combo-translator.ts
// Sistema di traduzione automatica per descrizioni combo in italiano

interface TranslationRule {
  pattern: RegExp
  replacement: string
  priority: number
}

// Dizionario per traduzioni specifiche dei termini MTG
const MTG_TERMS: { [key: string]: string } = {
  // Azioni base
  'tap': 'tappa',
  'untap': 'stappa',
  'draw': 'pesca',
  'discard': 'scarta',
  'sacrifice': 'sacrifica',
  'destroy': 'distruggi',
  'exile': 'esilia',
  'return': 'rimetti',
  'search': 'cerca',
  'shuffle': 'mescola',
  'mill': 'macina',
  'scry': 'scruta',
  'surveil': 'sorveglia',
  'explore': 'esplora',
  'investigate': 'investiga',
  'proliferate': 'prolifera',
  'populate': 'popola',
  'convoke': 'convocare',
  'delve': 'dissotterrare',
  'flashback': 'flashback',
  'jumpstart': 'jumpstart',
  'cycling': 'ciclare',
  'morph': 'metamorfosi',
  'manifest': 'manifestare',
  
  // Tipi di carta
  'creature': 'creatura',
  'creatures': 'creature',
  'artifact': 'artefatto',
  'artifacts': 'artefatti',
  'enchantment': 'incantesimo',
  'enchantments': 'incantesimi',
  'planeswalker': 'planeswalker',
  'planeswalkers': 'planeswalkers',
  'instant': 'istantaneo',
  'instants': 'istantanei',
  'sorcery': 'stregoneria',
  'sorceries': 'stregonerie',
  'land': 'terra',
  'lands': 'terre',
  'token': 'pedina',
  'tokens': 'pedine',
  
  // Zone di gioco
  'battlefield': 'campo di battaglia',
  'graveyard': 'cimitero',
  'library': 'grimorio',
  'hand': 'mano',
  'stack': 'pila',
  'command zone': 'zona di comando',
  
  // Meccaniche
  'enters the battlefield': 'entra nel campo di battaglia',
  'leaves the battlefield': 'lascia il campo di battaglia',
  'dies': 'muore',
  'attacks': 'attacca',
  'blocks': 'blocca',
  'deals damage': 'infligge danno',
  'takes damage': 'subisce danno',
  'gains life': 'guadagna punti vita',
  'loses life': 'perde punti vita',
  'draws a card': 'pesca una carta',
  'draws cards': 'pesca carte',
  'discards': 'scarta',
  'creates': 'crea',
  'copy': 'copia',
  'copies': 'copie',
  'double': 'raddoppia',
  'target': 'bersaglio',
  'targets': 'bersagli',
  
  // Valori e numeri
  'damage': 'danno',
  'life': 'punti vita',
  'poison counter': 'segnalino veleno',
  'poison counters': 'segnalini veleno',
  'counter': 'segnalino',
  'counters': 'segnalini',
  'mana': 'mana',
  'cost': 'costo',
  'power': 'forza',
  'toughness': 'costituzione',
  'loyalty': 'fedeltà',
  
  // Risultati combo
  'infinite': 'infinito',
  'unlimited': 'illimitato',
  'win the game': 'vinci la partita',
  'game over': 'fine partita',
  'lethal': 'letale',
  'game-winning': 'vincente',
  'devastating': 'devastante',
  'overwhelming': 'travolgente'
}

// Regole di traduzione per frasi comuni
const TRANSLATION_RULES: TranslationRule[] = [
  // Frasi complete - priorità alta
  {
    pattern: /trigger-enabler interaction, enabler-trigger interaction/gi,
    replacement: 'interazione innesco-facilitatore',
    priority: 10
  },
  {
    pattern: /payoff-enabler pair/gi,
    replacement: 'coppia facilitatore-ricompensa',
    priority: 10
  },
  {
    pattern: /token-creature interaction/gi,
    replacement: 'interazione pedina-creatura',
    priority: 10
  },
  {
    pattern: /good curve/gi,
    replacement: 'buona curva di mana',
    priority: 10
  },
  {
    pattern: /both creatures/gi,
    replacement: 'entrambe le creature',
    priority: 9
  },
  {
    pattern: /all creatures/gi,
    replacement: 'tutte le creature',
    priority: 9
  },
  {
    pattern: /each opponent/gi,
    replacement: 'ogni avversario',
    priority: 9
  },
  {
    pattern: /target opponent/gi,
    replacement: 'avversario bersaglio',
    priority: 9
  },
  {
    pattern: /any number of/gi,
    replacement: 'un qualsiasi numero di',
    priority: 9
  },
  {
    pattern: /up to (\d+)/gi,
    replacement: 'fino a $1',
    priority: 9
  },
  
  // Costruzioni comuni - priorità media
  {
    pattern: /(\w+) enters the battlefield/gi,
    replacement: '$1 entra nel campo di battaglia',
    priority: 8
  },
  {
    pattern: /(\w+) leaves the battlefield/gi,
    replacement: '$1 lascia il campo di battaglia',
    priority: 8
  },
  {
    pattern: /(\w+) dies/gi,
    replacement: '$1 muore',
    priority: 8
  },
  {
    pattern: /(\w+) attacks/gi,
    replacement: '$1 attacca',
    priority: 8
  },
  {
    pattern: /create (\d+) (\w+) tokens?/gi,
    replacement: 'crea $1 pedine $2',
    priority: 8
  },
  {
    pattern: /deal (\d+) damage/gi,
    replacement: 'infliggi $1 danni',
    priority: 8
  },
  {
    pattern: /gain (\d+) life/gi,
    replacement: 'guadagna $1 punti vita',
    priority: 8
  },
  {
    pattern: /draw (\d+) cards?/gi,
    replacement: 'pesca $1 carte',
    priority: 8
  },
  {
    pattern: /add (\d+) mana/gi,
    replacement: 'aggiungi $1 mana',
    priority: 8
  },
  
  // Parole singole - priorità bassa
  {
    pattern: /\bstep\b/gi,
    replacement: 'passo',
    priority: 5
  },
  {
    pattern: /\bturn\b/gi,
    replacement: 'turno',
    priority: 5
  },
  {
    pattern: /\bgame\b/gi,
    replacement: 'partita',
    priority: 5
  },
  {
    pattern: /\bopponent\b/gi,
    replacement: 'avversario',
    priority: 5
  },
  {
    pattern: /\bplayer\b/gi,
    replacement: 'giocatore',
    priority: 5
  },
  {
    pattern: /\bloop\b/gi,
    replacement: 'loop',
    priority: 5
  },
  {
    pattern: /\bcombo\b/gi,
    replacement: 'combo',
    priority: 5
  },
  {
    pattern: /\bsynergy\b/gi,
    replacement: 'sinergia',
    priority: 5
  },
  {
    pattern: /\bengine\b/gi,
    replacement: 'motore',
    priority: 5
  },
  {
    pattern: /\bvalue\b/gi,
    replacement: 'vantaggio',
    priority: 5
  }
]

/**
 * Traduce una descrizione di combo dall'inglese all'italiano
 */
export function translateComboDescription(text: string): string {
  if (!text || typeof text !== 'string') return text
  
  let translated = text
  
  // Applica le regole di traduzione in ordine di priorità
  const sortedRules = TRANSLATION_RULES.sort((a, b) => b.priority - a.priority)
  
  for (const rule of sortedRules) {
    translated = translated.replace(rule.pattern, rule.replacement)
  }
  
  // Applica traduzioni dei termini singoli
  for (const [english, italian] of Object.entries(MTG_TERMS)) {
    const regex = new RegExp(`\\b${english}\\b`, 'gi')
    translated = translated.replace(regex, italian)
  }
  
  // Pulizia finale
  translated = cleanupTranslation(translated)
  
  return translated
}

/**
 * Traduce i passi di una combo
 */
export function translateComboSteps(steps: string | string[]): string[] {
  if (typeof steps === 'string') {
    // Se è una stringa, dividi per punti o newlines
    const stepsArray = steps.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 0)
    return stepsArray.map(step => translateComboDescription(step))
  }
  
  if (Array.isArray(steps)) {
    return steps.map(step => translateComboDescription(step))
  }
  
  return []
}

/**
 * Traduce il nome di una combo
 */
export function translateComboName(name: string): string {
  if (!name) return name
  
  // Pattern per nomi combo comuni
  const namePatterns = [
    { pattern: /(.+)\s*\+\s*(.+)/g, replacement: '$1 + $2' },
    { pattern: /Infinite (.+)/gi, replacement: '$1 Infiniti' },
    { pattern: /(.+) Combo/gi, replacement: 'Combo $1' },
    { pattern: /(.+) Engine/gi, replacement: 'Motore $1' },
    { pattern: /(.+) Synergy/gi, replacement: 'Sinergia $1' },
  ]
  
  let translatedName = name
  
  // Applica pattern per i nomi
  for (const { pattern, replacement } of namePatterns) {
    translatedName = translatedName.replace(pattern, replacement)
  }
  
  // Traduce i singoli termini nel nome
  for (const [english, italian] of Object.entries(MTG_TERMS)) {
    const regex = new RegExp(`\\b${english}\\b`, 'gi')
    translatedName = translatedName.replace(regex, italian)
  }
  
  return translatedName
}

/**
 * Traduce un tag risultato di combo
 */
export function translateResultTag(tag: string): string {
  const tagTranslations: { [key: string]: string } = {
    'infinite damage': 'Danno Infinito',
    'infinite life': 'Punti Vita Infiniti', 
    'infinite mana': 'Mana Infinito',
    'infinite tokens': 'Pedine Infinite',
    'infinite mill': 'Mill Infinito',
    'win condition': 'Condizione di Vittoria',
    'game over': 'Fine Partita',
    'lethal combo': 'Combo Letale',
    'value engine': 'Motore di Vantaggio',
    'card advantage': 'Vantaggio Carte',
    'board control': 'Controllo Campo',
    'tempo play': 'Giocata Tempo',
    'synergy': 'Sinergia',
    'combo piece': 'Pezzo Combo',
    'enabler': 'Facilitatore',
    'payoff': 'Ricompensa'
  }
  
  const lowerTag = tag.toLowerCase()
  return tagTranslations[lowerTag] || tag
}

/**
 * Pulisce la traduzione da errori comuni
 */
function cleanupTranslation(text: string): string {
  let cleaned = text
  
  // Corregge problemi comuni
  cleaned = cleaned.replace(/\s+/g, ' ') // Spazi multipli
  cleaned = cleaned.replace(/^\s+|\s+$/g, '') // Spazi all'inizio/fine
  cleaned = cleaned.replace(/\.\s*\./g, '.') // Punti doppi
  cleaned = cleaned.replace(/,\s*,/g, ',') // Virgole doppie
  
  // Capitalizza la prima lettera
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  
  return cleaned
}

/**
 * Utility per tradurre un oggetto combo completo
 */
export function translateCombo(combo: any) {
  return {
    ...combo,
    name: translateComboName(combo.name),
    result_tag: translateResultTag(combo.result_tag),
    steps: translateComboSteps(combo.steps),
    // Mantieni i campi originali con suffisso _original per debug
    name_original: combo.name,
    result_tag_original: combo.result_tag,
    steps_original: combo.steps
  }
}