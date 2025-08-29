// src/app/admin/page.tsx - Admin dashboard con Scryfall Sync integrato
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

  // Nuovi stati per Scryfall Sync
  const [scryfallStats, setScryfallStats] = useState<ScryfallStats | null>(null)
  const [scryfallSyncResult, setScryfallSyncResult] = useState<ScryfallSyncResult | null>(null)
  const [scryfallSyncLoading, setScryfallSyncLoading] = useState(false)
  const [syncMode, setSyncMode] = useState<'outdated' | 'all' | 'missing_images' | 'missing_italian'>('outdated')
  const [syncLogs, setSyncLogs] = useState<string[]>([])

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

      // Dettagli combo per fonte
      const { data: comboDetails } = await supabase
        .from('combos')
        .select('source')

      const sources: { [key: string]: number } = {}
      comboDetails?.forEach(combo => {
        const source = combo.source || 'unknown'
        sources[source] = (sources[source] || 0) + 1
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
        combo_sources: sources
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

  const getSyncModeLabel = (mode: string) => {
    switch(mode) {
      case 'all': return 'Tutte le carte'
      case 'outdated': return 'Obsolete (>7 giorni)'
      case 'missing_images': return 'Senza immagini'
      case 'missing_italian': return 'Senza nomi IT'
      default: return mode
    }
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

        {/* Status Messages */}
        {seedingResult && (
          <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-6">
            <p className="text-green-400">
              Seeding completato: {seedingResult.combos_created} combo create, {seedingResult.relationships_created} relazioni
            </p>
          </div>
        )}

        {scryfallResult && (
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6">
            <p className="text-blue-400">
              Scryfall import completato: {scryfallResult.combos_created} combo create, {scryfallResult.cards_fetched} carte analizzate
            </p>
          </div>
        )}

        {newSetsResult && (
          <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4 mb-6">
            <p className="text-purple-400">
              New sets analysis completata: {newSetsResult.total_combos_created} combo create ({newSetsResult.internal_combos} interne + {newSetsResult.cross_combos} cross)
            </p>
          </div>
        )}

        {scryfallSyncResult && scryfallSyncResult.success && (
          <div className="bg-cyan-900/30 border border-cyan-500 rounded-lg p-4 mb-6">
            <p className="text-cyan-400">
              Scryfall sync completato: {scryfallSyncResult.stats?.cards_updated} carte aggiornate, 
              {scryfallSyncResult.stats?.cards_with_italian_names} con nomi italiani, 
              {scryfallSyncResult.stats?.cards_with_images} con immagini
            </p>
          </div>
        )}

        {/* Database Statistics */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Database Statistics</h2>
          
          <div className="grid grid-cols-3 gap-8 mb-6">
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

          <div>
            <h3 className="font-semibold mb-2">Combo per Fonte</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {databaseStats?.combo_sources && Object.entries(databaseStats.combo_sources).map(([source, count]) => (
                <div key={source} className="bg-gray-700 p-2 rounded text-center">
                  <div className="text-sm text-gray-400 capitalize">
                    {source.replace('_', ' ')}
                  </div>
                  <div className="font-bold">{count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons - 6 columns layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          
          {/* Scryfall Sync - ENHANCED */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-cyan-600 rounded flex items-center justify-center mr-3">
                🌍
              </div>
              <div>
                <h3 className="font-semibold">Scryfall Sync</h3>
                <p className="text-sm text-gray-400">Nomi IT + Immagini</p>
              </div>
            </div>
            
            {scryfallStats && (
              <div className="mb-4 text-sm space-y-1">
                <div>Totali: {scryfallStats.total_cards}</div>
                <div className="text-cyan-400">Con nomi IT: {scryfallStats.cards_with_italian_names} ({scryfallStats.italian_coverage_percentage?.toFixed(1)}%)</div>
                <div className="text-green-400">Con immagini: {scryfallStats.cards_with_images}</div>
                <div className="text-yellow-400">Sync recenti: {scryfallStats.cards_synced_last_week}</div>
              </div>
            )}
            
            <div className="mb-4">
              <select 
                value={syncMode} 
                onChange={(e) => setSyncMode(e.target.value as any)}
                className="w-full bg-gray-700 text-white p-2 rounded text-sm"
                disabled={scryfallSyncLoading}
              >
                <option value="outdated">Obsolete (&gt;7 giorni)</option>
                <option value="missing_italian">Senza nomi italiani</option>
                <option value="missing_images">Senza immagini</option>
                <option value="all">Tutte le carte</option>
              </select>
            </div>
            
            <button
              onClick={handleScryfallSync}
              disabled={scryfallSyncLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 p-3 rounded font-semibold disabled:opacity-50"
            >
              {scryfallSyncLoading ? 'Syncing...' : 'Sync Scryfall'}
            </button>
          </div>

          {/* Sync Combo */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center mr-3">
                🔄
              </div>
              <div>
                <h3 className="font-semibold">Sync Combo</h3>
                <p className="text-sm text-gray-400">Da esterni</p>
              </div>
            </div>
            
            <div className="mb-4 text-sm">
              <div>Combo DB: {databaseStats?.total_combos || 0}</div>
            </div>
            
            <button className="w-full bg-purple-600 hover:bg-purple-700 p-3 rounded font-semibold">
              Sync Combo
            </button>
          </div>

          {/* Seed Combo */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center mr-3">
                🌱
              </div>
              <div>
                <h3 className="font-semibold">Seed Combo</h3>
                <p className="text-sm text-gray-400">Arena only</p>
              </div>
            </div>
            
            <div className="mb-4 text-sm">
              <p>Combo curate per MTG Arena.</p>
            </div>
            
            <button
              onClick={handleSeedDatabase}
              disabled={seedingLoading}
              className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-semibold disabled:opacity-50"
            >
              {seedingLoading ? 'Seeding...' : 'Seed Database'}
            </button>
          </div>

          {/* Scryfall */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center mr-3">
                🔍
              </div>
              <div>
                <h3 className="font-semibold">Scryfall</h3>
                <p className="text-sm text-gray-400">AI patterns</p>
              </div>
            </div>
            
            <div className="mb-4 text-sm">
              <p>Analisi automatica carte Arena.</p>
            </div>
            
            <button
              onClick={handleScryfallImport}
              disabled={scryfallLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded font-semibold disabled:opacity-50"
            >
              {scryfallLoading ? 'Analyzing...' : 'Import Scryfall'}
            </button>
          </div>

          {/* New Sets */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center mr-3">
                ✨
              </div>
              <div>
                <h3 className="font-semibold">New Sets</h3>
                <p className="text-sm text-gray-400">Meta analysis</p>
              </div>
            </div>
            
            <div className="mb-4 text-sm">
              <p>Analizza combo delle ultime 3 espansioni.</p>
            </div>
            
            <button
              onClick={handleNewSetsAnalysis}
              disabled={newSetsLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 p-3 rounded font-semibold disabled:opacity-50"
            >
              {newSetsLoading ? 'Analyzing...' : 'Analyze New Sets'}
            </button>
          </div>

          {/* Utils */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center mr-3">
                ⚙️
              </div>
              <div>
                <h3 className="font-semibold">Utils</h3>
                <p className="text-sm text-gray-400">System tools</p>
              </div>
            </div>
            
            <div className="mb-4 text-sm">
              <p>Maintenance e utilities varie.</p>
            </div>
            
            <button className="w-full bg-gray-600 hover:bg-gray-700 p-3 rounded font-semibold">
              System Tools
            </button>
          </div>
        </div>

        {/* Scryfall Sync Logs */}
        {syncLogs.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mt-8">
            <h3 className="font-semibold mb-4">Scryfall Sync Log</h3>
            <div className="bg-gray-900 rounded p-4 max-h-60 overflow-y-auto">
              {syncLogs.map((log, index) => (
                <div key={index} className="text-sm text-gray-300 mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          
          {/* Scryfall Sync Results */}
          {scryfallSyncResult && scryfallSyncResult.stats && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Risultato Scryfall Sync</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">
                    {scryfallSyncResult.stats.cards_updated}
                  </div>
                  <div className="text-gray-400 text-sm">Carte aggiornate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {scryfallSyncResult.stats.cards_with_images}
                  </div>
                  <div className="text-gray-400 text-sm">Con immagini</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {scryfallSyncResult.stats.cards_with_italian_names}
                  </div>
                  <div className="text-gray-400 text-sm">Nomi italiani</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-400">
                    {scryfallSyncResult.stats.errors}
                  </div>
                  <div className="text-gray-400 text-sm">Errori</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-400">
                Modalità: {getSyncModeLabel(syncMode)}
              </div>
            </div>
          )}

          {/* Other Results */}
          {scryfallResult && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Risultato Scryfall</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {scryfallResult.combos_created}
                  </div>
                  <div className="text-gray-400 text-sm">Combo create</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {scryfallResult.cards_fetched}
                  </div>
                  <div className="text-gray-400 text-sm">Carte analizzate</div>
                </div>
              </div>
            </div>
          )}

          {/* New Sets Results */}
          {newSetsResult && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Risultato New Sets</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">
                    {newSetsResult.total_combos_created}
                  </div>
                  <div className="text-gray-400 text-sm">Combo create</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {newSetsResult.new_cards_analyzed}
                  </div>
                  <div className="text-gray-400 text-sm">Nuove carte</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {newSetsResult.internal_combos}
                  </div>
                  <div className="text-gray-400 text-sm">Combo interne</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-cyan-400">
                    {newSetsResult.cross_combos}
                  </div>
                  <div className="text-gray-400 text-sm">Combo cross</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}