// src/app/admin/page.tsx - Admin dashboard ottimizzato con dettagli avanzati
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface SeedingStats {
  combos_created: number
  cards_created: number
  relationships_created: number
  total_combos: number
  total_cards: number
  total_relationships: number
}

interface DatabaseStats {
  total_combos: number
  total_cards: number
  total_relationships: number
  arena_cards: number
  placeholder_cards: number
  combo_sources: { [key: string]: number }
  format_breakdown: { [key: string]: number }
  color_breakdown: { [key: string]: number }
  quality_breakdown: { [key: string]: number }
  recent_imports: Array<{
    source: string
    count: number
    last_import: string
  }>
}

interface NewSetsResult {
  new_cards_analyzed: number
  existing_cards_matched: number
  internal_combos: number
  cross_combos: number
  total_combos_created: number
}

interface ScryfallStats {
  total_cards: number
  cards_with_italian_names: number
  cards_with_images: number
  cards_synced_last_week: number
  italian_coverage_percentage: number
}

interface ScryfallSyncResult {
  success: boolean
  message: string
  stats?: {
    cards_processed: number
    cards_updated: number
    cards_with_italian_names: number
    cards_with_images: number
    errors: number
  }
  errors?: string[]
  log?: string[]
}

interface HistoricBrawlImportResult {
  success: boolean
  message: string
  stats?: {
    total_fetched: number
    valid_combos: number
    imported: number
    skipped: number
    errors: number
    color_breakdown: { [key: string]: number }
    quality_breakdown: { [key: string]: number }
  }
  log?: string[]
  errors?: string[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null)
  
  // Stati per ogni operazione
  const [seedingResult, setSeedingResult] = useState<SeedingStats | null>(null)
  const [seedingLoading, setSeedingLoading] = useState(false)
  
  const [scryfallResult, setScryfallResult] = useState<any | null>(null)
  const [scryfallLoading, setScryfallLoading] = useState(false)
  
  const [newSetsResult, setNewSetsResult] = useState<NewSetsResult | null>(null)
  const [newSetsLoading, setNewSetsLoading] = useState(false)

  // Stati per Scryfall Sync
  const [scryfallStats, setScryfallStats] = useState<ScryfallStats | null>(null)
  const [scryfallSyncResult, setScryfallSyncResult] = useState<ScryfallSyncResult | null>(null)
  const [scryfallSyncLoading, setScryfallSyncLoading] = useState(false)
  const [syncMode, setSyncMode] = useState<'outdated' | 'all' | 'missing_images' | 'missing_italian'>('outdated')
  const [syncLogs, setSyncLogs] = useState<string[]>([])

  // Stati per Commander Spellbook Import
  const [commanderSpellbookResult, setCommanderSpellbookResult] = useState<any | null>(null)
  const [commanderSpellbookLoading, setCommanderSpellbookLoading] = useState(false)
  const [commanderMaxCombos, setCommanderMaxCombos] = useState(200)

  // Stati per Historic Brawl Import - NUOVO
  const [historicBrawlResult, setHistoricBrawlResult] = useState<HistoricBrawlImportResult | null>(null)
  const [historicBrawlLoading, setHistoricBrawlLoading] = useState(false)
  const [historicMaxCombos, setHistoricMaxCombos] = useState(100)
  const [historicColorFilter, setHistoricColorFilter] = useState<string[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      loadDatabaseStats()
      loadScryfallStats()
    }
  }, [isAuthenticated])

  const handleAuth = () => {
    if (adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY) {
      setIsAuthenticated(true)
    } else {
      alert('Chiave admin non valida')
    }
  }

  async function loadScryfallStats() {
    try {
      const response = await fetch('/api/admin/sync-scryfall')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.stats) {
          setScryfallStats(data.stats)
        }
      }
    } catch (error) {
      console.error('Error loading Scryfall stats:', error)
    }
  }

  async function loadDatabaseStats() {
    try {
      const [combos, cards, relationships] = await Promise.all([
        supabase.from('combos').select('*', { count: 'exact', head: true }),
        supabase.from('cards').select('*', { count: 'exact', head: true }),
        supabase.from('combo_cards').select('*', { count: 'exact', head: true })
      ])

      // Dettagli combo per fonte con timestamp
      const { data: comboDetails } = await supabase
        .from('combos')
        .select('source, format, color_identity, result_tag, created_at')
        .order('created_at', { ascending: false })

      const sources: { [key: string]: number } = {}
      const formats: { [key: string]: number } = {}
      const colors: { [key: string]: number } = {}
      const qualities: { [key: string]: number } = {}
      const recentImports: { [key: string]: { count: number, last_import: string } } = {}

      comboDetails?.forEach(combo => {
        const source = combo.source || 'unknown'
        const format = combo.format || 'unspecified'
        const resultTag = combo.result_tag || 'unknown'
        
        // Conte per fonte
        sources[source] = (sources[source] || 0) + 1
        
        // Conte per formato
        formats[format] = (formats[format] || 0) + 1
        
        // Conte per qualità/tipo risultato
        qualities[resultTag] = (qualities[resultTag] || 0) + 1
        
        // Colori
        if (combo.color_identity && Array.isArray(combo.color_identity)) {
          const colorKey = combo.color_identity.length === 0 ? 'Colorless' : 
                          combo.color_identity.length === 1 ? `Mono${combo.color_identity[0]}` :
                          combo.color_identity.sort().join('')
          colors[colorKey] = (colors[colorKey] || 0) + 1
        }
        
        // Import recenti per fonte
        if (combo.created_at) {
          if (!recentImports[source] || new Date(combo.created_at) > new Date(recentImports[source].last_import)) {
            recentImports[source] = {
              count: sources[source],
              last_import: combo.created_at
            }
          }
        }
      })

      // Dettagli carte Arena vs placeholder
      const { data: cardDetails } = await supabase
        .from('cards')
        .select('in_arena, oracle_text')

      let arenaCards = 0
      let placeholderCards = 0
      cardDetails?.forEach(card => {
        if (card.in_arena) arenaCards++
        if (card.oracle_text && card.oracle_text.includes('Placeholder')) placeholderCards++
      })

      setDatabaseStats({
        total_combos: combos.count || 0,
        total_cards: cards.count || 0,
        total_relationships: relationships.count || 0,
        arena_cards: arenaCards,
        placeholder_cards: placeholderCards,
        combo_sources: sources,
        format_breakdown: formats,
        color_breakdown: colors,
        quality_breakdown: qualities,
        recent_imports: Object.entries(recentImports).map(([source, data]) => ({
          source,
          count: data.count,
          last_import: data.last_import
        }))
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleScryfallSync = async () => {
    setScryfallSyncLoading(true)
    setScryfallSyncResult(null)
    setSyncLogs([])
    
    try {
      const response = await fetch('/api/admin/sync-scryfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminKey,
          mode: syncMode,
          limit: 100
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setScryfallSyncResult(data)
        setSyncLogs(data.log || [])
        loadDatabaseStats()
        loadScryfallStats()
      } else {
        alert(`Scryfall sync fallito: ${data.message || 'Errore sconosciuto'}`)
        setSyncLogs(data.log || [])
      }
    } catch (error) {
      alert(`Errore Scryfall sync: ${error}`)
    } finally {
      setScryfallSyncLoading(false)
    }
  }

  const handleSeedDatabase = async () => {
    setSeedingLoading(true)
    setSeedingResult(null)
    
    try {
      const response = await fetch('/api/admin/seed-combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey })
      })
      
      const data = await response.json()
      
      if (data.success && data.stats) {
        setSeedingResult(data.stats)
        loadDatabaseStats()
      } else {
        alert(`Seeding fallito: ${data.message || 'Errore sconosciuto'}`)
      }
    } catch (error) {
      alert(`Errore seeding: ${error}`)
    } finally {
      setSeedingLoading(false)
    }
  }

  const handleScryfallImport = async () => {
    setScryfallLoading(true)
    setScryfallResult(null)
    
    try {
      const response = await fetch('/api/admin/import-scryfall-combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey, maxCards: 200 })
      })
      
      const data = await response.json()
      
      if (data.success && data.stats) {
        setScryfallResult(data.stats)
        loadDatabaseStats()
      } else {
        alert(`Scryfall import fallito: ${data.message || 'Errore sconosciuto'}`)
      }
    } catch (error) {
      alert(`Errore Scryfall: ${error}`)
    } finally {
      setScryfallLoading(false)
    }
  }

  const handleNewSetsAnalysis = async () => {
    setNewSetsLoading(true)
    setNewSetsResult(null)
    
    try {
      const response = await fetch('/api/admin/analyze-new-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey, expansionsCount: 3 })
      })
      
      const data = await response.json()
      
      if (data.success && data.stats) {
        setNewSetsResult(data.stats)
        loadDatabaseStats()
      } else {
        alert(`New sets analysis fallita: ${data.message || 'Errore sconosciuto'}`)
      }
    } catch (error) {
      alert(`Errore new sets: ${error}`)
    } finally {
      setNewSetsLoading(false)
    }
  }

  const handleCommanderSpellbookImport = async () => {
    setCommanderSpellbookLoading(true)
    setCommanderSpellbookResult(null)
    
    try {
      const response = await fetch('/api/admin/import-commander-spellbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminKey,
          maxCombos: commanderMaxCombos,
          minQuality: 4
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.stats) {
        setCommanderSpellbookResult(data.stats)
        loadDatabaseStats()
      } else {
        alert(`Commander Spellbook import fallito: ${data.message || 'Errore sconosciuto'}`)
      }
    } catch (error) {
      alert(`Errore Commander Spellbook: ${error}`)
    } finally {
      setCommanderSpellbookLoading(false)
    }
  }

  // NUOVO: Historic Brawl Import Handler
  const handleHistoricBrawlImport = async () => {
    setHistoricBrawlLoading(true)
    setHistoricBrawlResult(null)
    
    try {
      const response = await fetch('/api/admin/import-cards-realm-historic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminKey,
          maxCombos: historicMaxCombos,
          colorFilter: historicColorFilter.length > 0 ? historicColorFilter : null,
          skipExisting: true
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.stats) {
        setHistoricBrawlResult(data)
        loadDatabaseStats()
      } else {
        alert(`Historic Brawl import fallito: ${data.message || 'Errore sconosciuto'}`)
      }
    } catch (error) {
      alert(`Errore Historic Brawl: ${error}`)
    } finally {
      setHistoricBrawlLoading(false)
    }
  }

  const getSyncModeLabel = (mode: string) => {
    switch(mode) {
      case 'all': return 'Tutte le carte'
      case 'outdated': return 'Obsolete (>7 giorni)'
      case 'missing_images': return 'Senza immagini'
      case 'missing_italian': return 'Senza nomi IT'
      default: return mode
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-md mx-auto mt-20">
          <h1 className="text-2xl font-bold mb-6">Admin Access</h1>
          <input
            type="password"
            placeholder="Admin Key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded mb-4"
          />
          <button
            onClick={handleAuth}
            className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold"
          >
            Accedi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <span className="text-gray-400">MTG Arena AI Deck Builder</span>
        </div>

        {/* Enhanced Status Messages */}
        {seedingResult && (
          <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-green-400 font-semibold">✓ Seeding Completato</h4>
              <span className="text-green-300 text-sm">Arena Curated</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><span className="text-green-200">Combo:</span> <strong>{seedingResult.combos_created}</strong></div>
              <div><span className="text-green-200">Carte:</span> <strong>{seedingResult.cards_created}</strong></div>
              <div><span className="text-green-200">Relazioni:</span> <strong>{seedingResult.relationships_created}</strong></div>
            </div>
          </div>
        )}

        {scryfallResult && (
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-blue-400 font-semibold">✓ Scryfall Import Completato</h4>
              <span className="text-blue-300 text-sm">AI Pattern Analysis</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><span className="text-blue-200">Combo:</span> <strong>{scryfallResult.combos_created}</strong></div>
              <div><span className="text-blue-200">Carte Analizzate:</span> <strong>{scryfallResult.cards_fetched}</strong></div>
              <div><span className="text-blue-200">Pattern AI:</span> <strong>{scryfallResult.patterns_found || 'N/A'}</strong></div>
            </div>
          </div>
        )}

        {newSetsResult && (
          <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-purple-400 font-semibold">✓ New Sets Analysis Completata</h4>
              <span className="text-purple-300 text-sm">Meta Evolution</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><span className="text-purple-200">Combo Totali:</span> <strong>{newSetsResult.total_combos_created}</strong></div>
              <div><span className="text-purple-200">Interne:</span> <strong>{newSetsResult.internal_combos}</strong></div>
              <div><span className="text-purple-200">Cross-Set:</span> <strong>{newSetsResult.cross_combos}</strong></div>
              <div><span className="text-purple-200">Carte Nuove:</span> <strong>{newSetsResult.new_cards_analyzed}</strong></div>
            </div>
          </div>
        )}

        {scryfallSyncResult && scryfallSyncResult.success && (
          <div className="bg-cyan-900/30 border border-cyan-500 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-cyan-400 font-semibold">✓ Scryfall Sync Completato</h4>
              <span className="text-cyan-300 text-sm">{getSyncModeLabel(syncMode)}</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><span className="text-cyan-200">Aggiornate:</span> <strong>{scryfallSyncResult.stats?.cards_updated}</strong></div>
              <div><span className="text-cyan-200">Nomi IT:</span> <strong>{scryfallSyncResult.stats?.cards_with_italian_names}</strong></div>
              <div><span className="text-cyan-200">Immagini:</span> <strong>{scryfallSyncResult.stats?.cards_with_images}</strong></div>
              <div><span className="text-cyan-200">Errori:</span> <strong>{scryfallSyncResult.stats?.errors}</strong></div>
            </div>
          </div>
        )}

        {commanderSpellbookResult && (
          <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-yellow-400 font-semibold">✓ Commander Spellbook Import Completato</h4>
              <span className="text-yellow-300 text-sm">EDH Database</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><span className="text-yellow-200">Importate:</span> <strong>{commanderSpellbookResult.imported}</strong></div>
              <div><span className="text-yellow-200">Alta Qualità:</span> <strong>{commanderSpellbookResult.high_quality}</strong></div>
              <div><span className="text-yellow-200">Media Qualità:</span> <strong>{commanderSpellbookResult.medium_quality}</strong></div>
              <div><span className="text-yellow-200">Ignorate:</span> <strong>{commanderSpellbookResult.skipped}</strong></div>
            </div>
          </div>
        )}

        {/* NUOVO: Historic Brawl Results */}
        {historicBrawlResult && historicBrawlResult.success && (
          <div className="bg-orange-900/30 border border-orange-500 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-orange-400 font-semibold">✓ Historic Brawl Import Completato</h4>
              <span className="text-orange-300 text-sm">MTG Arena Specific</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><span className="text-orange-200">Importate:</span> <strong>{historicBrawlResult.stats?.imported}</strong></div>
              <div><span className="text-orange-200">Trovate:</span> <strong>{historicBrawlResult.stats?.total_fetched}</strong></div>
              <div><span className="text-orange-200">Valide:</span> <strong>{historicBrawlResult.stats?.valid_combos}</strong></div>
              <div><span className="text-orange-200">Errori:</span> <strong>{historicBrawlResult.stats?.errors}</strong></div>
            </div>
            {historicBrawlResult.stats?.color_breakdown && (
              <div className="mt-3 pt-3 border-t border-orange-700">
                <span className="text-orange-300 text-sm">Breakdown Colori: </span>
                {Object.entries(historicBrawlResult.stats.color_breakdown).map(([color, count]) => (
                  <span key={color} className="text-orange-200 text-sm mr-3">{color}: {count}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enhanced Database Statistics */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Database Statistics</h2>
          
          {/* Main Stats */}
          <div className="grid grid-cols-3 gap-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">
                {databaseStats?.total_combos || 0}
              </div>
              <div className="text-gray-400">Combo Totali</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {databaseStats?.total_cards || 0}
              </div>
              <div className="text-gray-400">Carte Totali</div>
              <div className="text-sm text-gray-500 mt-1">
                ({databaseStats?.arena_cards || 0} Arena, {databaseStats?.placeholder_cards || 0} placeholder)
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">
                {databaseStats?.total_relationships || 0}
              </div>
              <div className="text-gray-400">Relazioni</div>
            </div>
          </div>

          {/* Enhanced Breakdown Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Combo Sources */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                Combo per Fonte
              </h3>
              <div className="space-y-2">
                {databaseStats?.combo_sources && Object.entries(databaseStats.combo_sources)
                  .sort(([,a], [,b]) => b - a)
                  .map(([source, count]) => (
                  <div key={source} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                    <div>
                      <span className="font-medium capitalize">
                        {source.replace(/_/g, ' ').replace('cards realm historic', 'Historic Brawl')}
                      </span>
                      {databaseStats.recent_imports.find(r => r.source === source) && (
                        <div className="text-xs text-gray-400">
                          Ultimo: {formatDate(databaseStats.recent_imports.find(r => r.source === source)!.last_import)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{count}</div>
                      <div className="text-xs text-gray-400">
                        {((count / (databaseStats.total_combos || 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Format Breakdown */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                Combo per Formato
              </h3>
              <div className="space-y-2">
                {databaseStats?.format_breakdown && Object.entries(databaseStats.format_breakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([format, count]) => (
                  <div key={format} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                    <span className="font-medium">{format || 'Non specificato'}</span>
                    <div className="text-right">
                      <div className="font-bold">{count}</div>
                      <div className="text-xs text-gray-400">
                        {((count / (databaseStats.total_combos || 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Color Breakdown */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                Combo per Colore
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {databaseStats?.color_breakdown && Object.entries(databaseStats.color_breakdown)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([color, count]) => (
                  <div key={color} className="bg-gray-700 p-2 rounded text-center">
                    <div className="text-sm font-medium">{color}</div>
                    <div className="font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Breakdown */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                Combo per Tipo
              </h3>
              <div className="space-y-1">
                {databaseStats?.quality_breakdown && Object.entries(databaseStats.quality_breakdown)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 6)
                  .map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center bg-gray-700 p-2 rounded text-sm">
                    <span>{type}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Action Buttons - Updated Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
          
          {/* Scryfall Sync */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-cyan-600 rounded flex items-center justify-center mr-2 text-xs">🌐</div>
              <div>
                <h3 className="font-semibold text-sm">Scryfall Sync</h3>
                <p className="text-xs text-gray-400">Nomi IT + Immagini</p>
              </div>
            </div>
            
            {scryfallStats && (
              <div className="mb-3 text-xs space-y-1">
                <div>IT: {scryfallStats.cards_with_italian_names} ({scryfallStats.italian_coverage_percentage?.toFixed(1)}%)</div>
                <div>IMG: {scryfallStats.cards_with_images}</div>
              </div>
            )}
            
            <select 
              value={syncMode} 
              onChange={(e) => setSyncMode(e.target.value as any)}
              className="w-full bg-gray-700 text-white p-1.5 rounded text-xs mb-3"
              disabled={scryfallSyncLoading}
            >
              <option value="outdated">Obsolete</option>
              <option value="missing_italian">Senza IT</option>
              <option value="missing_images">Senza IMG</option>
              <option value="all">Tutte</option>
            </select>
            
            <button
              onClick={handleScryfallSync}
              disabled={scryfallSyncLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 p-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              {scryfallSyncLoading ? 'Syncing...' : 'Sync'}
            </button>
          </div>

          {/* Sync Combo */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center mr-2 text-xs">🔄</div>
              <div>
                <h3 className="font-semibold text-sm">Sync Combo</h3>
                <p className="text-xs text-gray-400">Da esterni</p>
              </div>
            </div>
            <div className="mb-3 text-xs">Combo: {databaseStats?.total_combos || 0}</div>
            <button className="w-full bg-purple-600 hover:bg-purple-700 p-2 rounded text-sm font-semibold">
              Sync Combo
            </button>
          </div>

          {/* Seed Combo */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center mr-2 text-xs">🌱</div>
              <div>
                <h3 className="font-semibold text-sm">Seed Combo</h3>
                <p className="text-xs text-gray-400">Arena curated</p>
              </div>
            </div>
            <div className="mb-3 text-xs">Combo curate per MTG Arena</div>
            <button
              onClick={handleSeedDatabase}
              disabled={seedingLoading}
              className="w-full bg-green-600 hover:bg-green-700 p-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              {seedingLoading ? 'Seeding...' : 'Seed'}
            </button>
          </div>

          {/* Scryfall */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center mr-2 text-xs">🔍</div>
              <div>
                <h3 className="font-semibold text-sm">Scryfall AI</h3>
                <p className="text-xs text-gray-400">Pattern analysis</p>
              </div>
            </div>
            <div className="mb-3 text-xs">Analisi automatica carte Arena</div>
            <button
              onClick={handleScryfallImport}
              disabled={scryfallLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              {scryfallLoading ? 'Analyzing...' : 'Import'}
            </button>
          </div>

          {/* New Sets */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center mr-2 text-xs">✨</div>
              <div>
                <h3 className="font-semibold text-sm">New Sets</h3>
                <p className="text-xs text-gray-400">Meta analysis</p>
              </div>
            </div>
            <div className="mb-3 text-xs">Ultime 3 espansioni</div>
            <button
              onClick={handleNewSetsAnalysis}
              disabled={newSetsLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 p-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              {newSetsLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {/* Commander Spellbook */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-yellow-600 rounded flex items-center justify-center mr-2 text-xs">📚</div>
              <div>
                <h3 className="font-semibold text-sm">Commander</h3>
                <p className="text-xs text-gray-400">EDH Database</p>
              </div>
            </div>
            <div className="mb-2">
              <input
                type="number"
                value={commanderMaxCombos}
                onChange={(e) => setCommanderMaxCombos(parseInt(e.target.value) || 200)}
                min="50"
                max="1000"
                step="50"
                className="w-full bg-gray-700 text-white p-1 rounded text-xs"
                disabled={commanderSpellbookLoading}
              />
            </div>
            <button
              onClick={handleCommanderSpellbookImport}
              disabled={commanderSpellbookLoading}
              className="w-full bg-yellow-600 hover:bg-yellow-700 p-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              {commanderSpellbookLoading ? 'Importing...' : 'Import EDH'}
            </button>
          </div>

          {/* NUOVO: Historic Brawl */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center mr-2 text-xs">⚔️</div>
              <div>
                <h3 className="font-semibold text-sm">Historic Brawl</h3>
                <p className="text-xs text-gray-400">Arena specific</p>
              </div>
            </div>
            <div className="mb-2">
              <input
                type="number"
                value={historicMaxCombos}
                onChange={(e) => setHistoricMaxCombos(parseInt(e.target.value) || 100)}
                min="25"
                max="500"
                step="25"
                className="w-full bg-gray-700 text-white p-1 rounded text-xs mb-2"
                disabled={historicBrawlLoading}
              />
              <select
                multiple
                value={historicColorFilter}
                onChange={(e) => setHistoricColorFilter(Array.from(e.target.selectedOptions, option => option.value))}
                className="w-full bg-gray-700 text-white p-1 rounded text-xs h-16"
                disabled={historicBrawlLoading}
              >
                <option value="">Tutti i colori</option>
                <option value="W">Bianco</option>
                <option value="U">Blu</option>
                <option value="B">Nero</option>
                <option value="R">Rosso</option>
                <option value="G">Verde</option>
              </select>
            </div>
            <button
              onClick={handleHistoricBrawlImport}
              disabled={historicBrawlLoading}
              className="w-full bg-red-600 hover:bg-red-700 p-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              {historicBrawlLoading ? 'Importing...' : 'Import HB'}
            </button>
          </div>
        </div>

        {/* Logs Section */}
        {syncLogs.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mt-8">
            <h3 className="font-semibold mb-4">Import Log</h3>
            <div className="bg-gray-900 rounded p-4 max-h-60 overflow-y-auto">
              {syncLogs.map((log, index) => (
                <div key={index} className="text-sm text-gray-300 mb-1 font-mono">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}