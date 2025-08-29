// scripts/seed-combos.js
// Script per popolare il database con combo da fonti pubbliche

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Sources per combo database
const COMBO_SOURCES = {
  COMMANDER_SPELLBOOK: 'https://backend.commanderspellbook.com/combos',
  DRAFTSIM_COMBOS: 'manual', // Combo estratte da articoli
  MTGNEXUS_COMBOS: 'manual'  // Combo famose EDH
}

// Combo manuali famose da integrare
const FAMOUS_COMBOS = [
  // Infinite Damage
  {
    cards: ['Exquisite Blood', 'Sanguine Bond'],
    category: 'infinite_damage',
    type: 'infinite',
    description: 'Combo vita infinita: quando guadagni vita, l\'avversario perde vita, che ti fa guadagnare vita, loop infinito',
    steps: [
      'Gioca Exquisite Blood e Sanguine Bond',
      'Guadagna 1 punto vita con qualsiasi metodo', 
      'Sanguine Bond fa perdere 1 vita all\'avversario',
      'Exquisite Blood ti fa guadagnare 1 vita',
      'Loop infinito fino alla morte dell\'avversario'
    ],
    power_level: 8,
    setup_turns: 4,
    mana_cost_total: 9,
    reliability: 'high',
    colors: ['B', 'W'],
    format_legal: ['historic', 'commander', 'legacy']
  },
  
  // Infinite Tokens  
  {
    cards: ['Kiki-Jiki, Mirror Breaker', 'Restoration Angel'],
    category: 'infinite_tokens',
    type: 'infinite',
    description: 'Combo token infiniti: Kiki-Jiki copia Restoration Angel che resetta Kiki-Jiki',
    steps: [
      'Gioca Kiki-Jiki, Mirror Breaker',
      'Gioca Restoration Angel',
      'Tappa Kiki-Jiki per copiare Restoration Angel',
      'La copia entra e fa lampeggiare Kiki-Jiki (untap)',
      'Ripeti per token infiniti con haste'
    ],
    power_level: 9,
    setup_turns: 5,
    mana_cost_total: 9,
    reliability: 'high',
    colors: ['R', 'W'],
    format_legal: ['modern', 'commander', 'legacy']
  },

  // Infinite Mana
  {
    cards: ['Basalt Monolith', 'Rings of Brighthearth'],
    category: 'infinite_mana',
    type: 'infinite',
    description: 'Combo mana infinito: usa Rings per copiare l\'abilità di untap del Monolith',
    steps: [
      'Gioca Basalt Monolith e Rings of Brighthearth',
      'Tappa Basalt Monolith per 3 mana incolore',
      'Paga 3 per untappare Basalt Monolith',
      'Paga 2 per copiare l\'abilità con Rings',
      'Risolvi entrambe per mana netto +1 infinito'
    ],
    power_level: 7,
    setup_turns: 4,
    mana_cost_total: 5,
    reliability: 'high',
    colors: [],
    format_legal: ['commander', 'legacy', 'vintage']
  },

  // Mill Infinite
  {
    cards: ['Painter\'s Servant', 'Grindstone'],
    category: 'infinite_mill',
    type: 'infinite', 
    description: 'Combo mill infinito: Grindstone milla tutto il deck perché le carte sono dello stesso colore',
    steps: [
      'Gioca Painter\'s Servant nominando un colore',
      'Gioca Grindstone',
      'Attiva Grindstone targettando un avversario',
      'Tutte le carte sono dello stesso colore',
      'Mill dell\'intero deck'
    ],
    power_level: 8,
    setup_turns: 3,
    mana_cost_total: 4,
    reliability: 'high',
    colors: [],
    format_legal: ['legacy', 'vintage']
  },

  // Infinite Turns
  {
    cards: ['Nexus of Fate', 'Teferi, Hero of Dominaria'],
    category: 'infinite_turns',
    type: 'infinite',
    description: 'Turni infiniti: Teferi rimette Nexus nel deck, Nexus ti da turni extra',
    steps: [
      'Gioca Teferi, Hero of Dominaria',
      'Gioca Nexus of Fate per turno extra',
      'Nel turno extra, usa +1 di Teferi per rimettere Nexus nel deck',
      'Pesca Nexus e ripeti'
    ],
    power_level: 9,
    setup_turns: 6,
    mana_cost_total: 11,
    reliability: 'medium',
    colors: ['U', 'W'],
    format_legal: ['historic', 'commander']
  },

  // Combo Blue Mill semplice
  {
    cards: ['Drowned Secrets', 'Persistent Petitioners'],
    category: 'mill_synergy',
    type: 'synergy',
    description: 'Mill engine: ogni spell fa millare, Advisors tappano per mill extra',
    steps: [
      'Gioca Drowned Secrets',
      'Gioca multiple Persistent Petitioners', 
      'Ogni spell blu fa mill grazie a Drowned Secrets',
      'Tappa 4+ Advisors per mill extra'
    ],
    power_level: 6,
    setup_turns: 5,
    mana_cost_total: 8,
    reliability: 'medium',
    colors: ['U'],
    format_legal: ['standard', 'historic', 'commander']
  },

  // Combo Control Lock
  {
    cards: ['Teferi, Time Raveler', 'Knowledge Pool'],
    category: 'lock_stax',
    type: 'win_condition',
    description: 'Lock totale: gli avversari non possono giocare spell (solo istantanei, ma Teferi li blocca)',
    steps: [
      'Gioca Teferi, Time Raveler',
      'Gioca Knowledge Pool',
      'Gli avversari possono giocare solo istantanei',
      'Ma Teferi impedisce istantanei nei turni altrui',
      'Lock completo'
    ],
    power_level: 8,
    setup_turns: 6,
    mana_cost_total: 9,
    reliability: 'medium',
    colors: ['U', 'W'],
    format_legal: ['historic', 'commander']
  }
]

async function seedComboDatabase() {
  console.log('🌱 Iniziando seed del database combo...')
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Environment variables mancanti: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Pulisci database esistente (opzionale)
    console.log('🗑️  Pulendo database esistente...')
    const { error: deleteError } = await supabase
      .from('combos')
      .delete()
      .neq('id', 'never_match') // Trucco per eliminare tutto
    
    if (deleteError) {
      console.warn('Attenzione pulizia DB:', deleteError.message)
    }

    // 2. Inserisci combo famose manuali
    console.log('📚 Inserendo combo famose...')
    for (let i = 0; i < FAMOUS_COMBOS.length; i++) {
      const combo = FAMOUS_COMBOS[i]
      
      const { error } = await supabase
        .from('combos')
        .insert({
          id: `famous_${i + 1}`,
          cards: combo.cards,
          category: combo.category,
          type: combo.type,
          description: combo.description,
          steps: combo.steps,
          power_level: combo.power_level,
          setup_turns: combo.setup_turns,
          mana_cost_total: combo.mana_cost_total,
          reliability: combo.reliability,
          colors: combo.colors,
          format_legal: combo.format_legal,
          source: 'manual_famous',
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error(`Errore inserimento combo ${combo.cards.join(' + ')}:`, error)
      } else {
        console.log(`✅ Inserita: ${combo.cards.join(' + ')}`)
      }
    }

    // 3. Importa da Commander Spellbook (sample, rate limited)
    console.log('🔍 Importando da Commander Spellbook...')
    await importFromCommanderSpellbook(supabase)

    // 4. Statistiche finali
    const { count, error: countError } = await supabase
      .from('combos')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Errore conteggio:', countError)
    } else {
      console.log(`🎉 Seed completato! ${count} combo nel database.`)
    }

  } catch (error) {
    console.error('❌ Errore durante seed:', error)
    throw error
  }
}

async function importFromCommanderSpellbook(supabase) {
  try {
    // API pubblica Commander Spellbook
    console.log('📡 Chiamando API Commander Spellbook...')
    
    const response = await fetch('https://backend.commanderspellbook.com/combos/', {
      headers: {
        'User-Agent': 'MTGArenaAI/1.0',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`📊 Ricevute ${data.results?.length || 0} combo da Commander Spellbook`)

    // Processare solo le prime 50 combo per evitare rate limiting
    const combosToProcess = (data.results || []).slice(0, 50)
    
    for (let i = 0; i < combosToProcess.length; i++) {
      const combo = combosToProcess[i]
      
      // Converti formato Commander Spellbook al nostro schema
      const processedCombo = processCommanderSpellbookCombo(combo, i)
      
      if (processedCombo) {
        const { error } = await supabase
          .from('combos')
          .insert(processedCombo)

        if (error) {
          console.error(`Errore inserimento CS combo ${i}:`, error.message)
        } else {
          console.log(`✅ CS combo ${i}: ${processedCombo.cards.slice(0,2).join(' + ')}...`)
        }
      }

      // Rate limiting - pausa tra inserimenti
      if (i > 0 && i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

  } catch (error) {
    console.warn('⚠️  Commander Spellbook import fallito:', error.message)
    console.log('Continuando con combo manuali...')
  }
}

function processCommanderSpellbookCombo(combo, index) {
  try {
    // Estrai info dal formato Commander Spellbook
    const cards = combo.uses?.map(use => use.card?.name).filter(Boolean) || []
    const results = combo.produces || []
    
    if (cards.length === 0) return null

    // Determina categoria dal risultato
    let category = 'synergy'
    let type = 'synergy'
    
    const resultText = results.join(' ').toLowerCase()
    if (resultText.includes('infinite')) {
      type = 'infinite'
      if (resultText.includes('damage')) category = 'infinite_damage'
      else if (resultText.includes('mana')) category = 'infinite_mana'  
      else if (resultText.includes('token')) category = 'infinite_tokens'
      else if (resultText.includes('mill')) category = 'infinite_mill'
      else if (resultText.includes('turn')) category = 'infinite_turns'
      else if (resultText.includes('life')) category = 'infinite_life'
      else category = 'infinite_combo'
    } else if (resultText.includes('win')) {
      type = 'win_condition'
      category = 'instant_win'
    }

    return {
      id: `cs_${index}`,
      cards: cards.slice(0, 6), // Max 6 carte per combo
      category,
      type,
      description: results.join(', ') || `Combo with ${cards.slice(0,3).join(', ')}`,
      steps: combo.description ? [combo.description] : [`Use ${cards.join(' + ')}`],
      power_level: estimatePowerLevel(cards.length, type),
      setup_turns: estimateSetupTurns(cards.length),
      mana_cost_total: estimateManaCost(cards),
      reliability: cards.length <= 3 ? 'high' : 'medium',
      colors: extractColors(cards),
      format_legal: ['commander'], // Commander Spellbook è per EDH
      source: 'commander_spellbook',
      created_at: new Date().toISOString()
    }

  } catch (error) {
    console.warn(`Errore processing combo ${index}:`, error.message)
    return null
  }
}

function estimatePowerLevel(cardCount, type) {
  let base = 5
  if (type === 'infinite') base = 8
  else if (type === 'win_condition') base = 7
  
  // Meno carte = più potente
  if (cardCount === 2) base += 1
  else if (cardCount >= 4) base -= 1
  
  return Math.max(1, Math.min(10, base))
}

function estimateSetupTurns(cardCount) {
  return Math.max(2, cardCount + 1)
}

function estimateManaCost(cards) {
  // Stima grossolana basata su numero carte
  return cards.length * 3 + Math.floor(Math.random() * 3)
}

function extractColors(cards) {
  // Estrazione colori semplificata da nomi carte
  const colors = []
  const cardText = cards.join(' ').toLowerCase()
  
  if (cardText.includes('white') || cardText.includes('angel') || cardText.includes('serra')) colors.push('W')
  if (cardText.includes('blue') || cardText.includes('island') || cardText.includes('counter')) colors.push('U') 
  if (cardText.includes('black') || cardText.includes('swamp') || cardText.includes('demon')) colors.push('B')
  if (cardText.includes('red') || cardText.includes('mountain') || cardText.includes('dragon')) colors.push('R')
  if (cardText.includes('green') || cardText.includes('forest') || cardText.includes('elf')) colors.push('G')
  
  return [...new Set(colors)]
}

// Esegui seed se chiamato direttamente
if (require.main === module) {
  seedComboDatabase()
    .then(() => {
      console.log('🎊 Seed completato con successo!')
      process.exit(0)
    })
    .catch(error => {
      console.error('💥 Seed fallito:', error)
      process.exit(1)
    })
}

module.exports = { seedComboDatabase, FAMOUS_COMBOS }