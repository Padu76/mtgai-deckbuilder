// Aggiornamento per src/app/admin/page.tsx - Con pulsante seeding combo
'use client'
import { useEffect, useState } from 'react'

interface SeedingStats {
  combos_created: number
  cards_created: number
  relationships_created: number
  total_combos: number
  total_cards: number
  total_relationships: number
}

interface SeedingResult {
  success: boolean
  message: string
  stats?: SeedingStats
  errors?: string[]
  log?: string[]
}

export default function AdminPage() {
  const [status, setStatus] = useState<string>('')
  const [allowed, setAllowed] = useState<boolean>(false)
  const [keyInput, setKeyInput] = useState<string>('')
  const [keyParam, setKeyParam] = useState<string>('')
  const [info, setInfo] = useState<any|null>(null)
  const [comboStats, setComboStats] = useState<any|null>(null)
  const [syncingCards, setSyncingCards] = useState(false)
  const [syncingCombos, setSyncingCombos] = useState(false)
  
  // Nuovo stato per seeding
  const [seedingCombos, setSeedingCombos] = useState(false)
  const [seedingResult, setSeedingResult] = useState<SeedingResult | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const k = url.searchParams.get('key') || ''
    if (k) { setKeyParam(k); verify(k) }
  }, [])

  async function loadStatus() {
    try {
      const res = await fetch('/api/admin/status')
      const data = await res.json()
      if (data.ok) setInfo(data)
    } catch (error) {
      console.error('Error loading status:', error)
    }
  }

  async function loadComboStats() {
    try {
      const res = await fetch('/api/combos?limit=1')
      const data = await res.json()
      if (data.ok) {
        setComboStats({
          total: data.count || 0,
          lastSync: 'N/D'
        })
      }
    } catch (error) {
      console.error('Error loading combo stats:', error)
    }
  }

  function verify(k: string) {
    const ADMIN = process.env.NEXT_PUBLIC_ADMIN_KEY || ''
    if (!ADMIN) { 
      setStatus('⚠️ Chiave admin non impostata nelle env.')
      return 
    }
    if (k === ADMIN) {
      setAllowed(true)
      setStatus('✅ Accesso admin abilitato.')
      loadStatus()
      loadComboStats()
    } else {
      setAllowed(false)
      setStatus('❌ Chiave errata.')
    }
  }

  async function runCardsSync() {
    setSyncingCards(true)
    setStatus('⏳ Avvio sync carte Scryfall...')
    try {
      const k = keyParam || keyInput
      const res = await fetch('/api/admin/sync-scryfall', { 
        headers: { 'x-admin-key': k } 
      })
      const json = await res.json()
      
      if (!res.ok || json.ok === false) {
        setStatus('❌ Errore sync carte: ' + (json.error || res.status))
      } else {
        setStatus(`✅ Sync carte OK: ${json.upserts} carte, ${json.arena_cards} su Arena`)
        loadStatus()
      }
    } catch (e: any) { 
      setStatus('❌ Errore: ' + e.message) 
    } finally {
      setSyncingCards(false)
    }
  }

  async function runComboSync() {
    setSyncingCombos(true)
    setStatus('⏳ Avvio sync combo da Commander Spellbook e Cards Realm...')
    try {
      const k = keyParam || keyInput
      const res = await fetch('/api/admin/sync-combos', { 
        headers: { 'x-admin-key': k } 
      })
      const json = await res.json()
      
      if (!res.ok || json.ok === false) {
        setStatus('❌ Errore sync combo: ' + (json.error || res.status))
      } else {
        setStatus(`✅ Sync combo OK: ${json.inserted} nuove combo aggiunte (${json.processed} processate)`)
        loadComboStats()
      }
    } catch (e: any) { 
      setStatus('❌ Errore: ' + e.message) 
    } finally {
      setSyncingCombos(false)
    }
  }

  // Nuova funzione per seeding combo
  async function runComboSeeding() {
    setSeedingCombos(true)
    setSeedingResult(null)
    setStatus('⏳ Avvio seeding 50+ combo famose...')
    
    try {
      const k = keyParam || keyInput
      const res = await fetch('/api/admin/seed-combos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminKey: k
        })
      })
      
      const result: SeedingResult = await res.json()
      setSeedingResult(result)
      
      if (result.success) {
        setStatus(`✅ Seeding completato: ${result.stats?.combos_created} combo, ${result.stats?.cards_created} carte create`)
        loadComboStats()
      } else {
        setStatus('❌ Errore seeding: ' + result.message)
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Errore sconosciuto'
      setStatus('❌ Errore di rete: ' + errorMsg)
      setSeedingResult({
        success: false,
        message: errorMsg,
        errors: ['Impossibile contattare il server']
      })
    } finally {
      setSeedingCombos(false)
    }
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Admin Access</h2>
            <p className="text-gray-400">Inserisci la chiave admin per continuare</p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="password"
              placeholder="Admin Key"
              value={keyInput} 
              onChange={e => setKeyInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-3 focus:border-orange-500 focus:outline-none transition-colors"
            />
            <button 
              onClick={() => verify(keyInput)}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium px-4 py-3 rounded-lg transition-colors"
            >
              Accedi
            </button>
            
            {status && (
              <div className="text-center text-sm mt-4">
                <span className={status.includes('✅') ? 'text-green-400' : 'text-red-400'}>
                  {status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <div className="text-sm text-gray-400">MTG Arena AI Deck Builder</div>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className={`mb-6 p-4 rounded-lg border ${
            status.includes('✅') 
              ? 'bg-green-900/50 border-green-500 text-green-100'
              : status.includes('❌')
              ? 'bg-red-900/50 border-red-500 text-red-100'
              : 'bg-blue-900/50 border-blue-500 text-blue-100'
          }`}>
            {status}
          </div>
        )}

        {/* Main Actions - Aggiornato con 3 colonne */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Cards Sync */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
                <span className="text-xl">🃏</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Sync Carte</h3>
                <p className="text-gray-400 text-xs">Da Scryfall</p>
              </div>
            </div>
            
            {info && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Totali</span>
                  <span className="text-white">{info.total_cards?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Arena</span>
                  <span className="text-white">{info.total_arena?.toLocaleString()}</span>
                </div>
              </div>
            )}
            
            <button
              onClick={runCardsSync}
              disabled={syncingCards}
              className={`w-full font-medium py-2 px-4 rounded-lg transition-colors text-sm ${
                syncingCards
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {syncingCards ? 'Sync...' : 'Sync Carte'}
            </button>
          </div>

          {/* Combo Sync */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mr-4">
                <span className="text-xl">💫</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Sync Combo</h3>
                <p className="text-gray-400 text-xs">Da esterni</p>
              </div>
            </div>
            
            {comboStats && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Combo DB</span>
                  <span className="text-white">{comboStats.total.toLocaleString()}</span>
                </div>
              </div>
            )}
            
            <button
              onClick={runComboSync}
              disabled={syncingCombos}
              className={`w-full font-medium py-2 px-4 rounded-lg transition-colors text-sm ${
                syncingCombos
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {syncingCombos ? 'Sync...' : 'Sync Combo'}
            </button>
          </div>

          {/* NUOVO: Combo Seeding */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mr-4">
                <span className="text-xl">🌱</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Seed Combo</h3>
                <p className="text-gray-400 text-xs">50+ famose</p>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-3 mb-4 text-xs">
              <div className="text-gray-300">
                Popola il database con combo curate manualmente per iniziare subito a testare le funzioni.
              </div>
            </div>
            
            <button
              onClick={runComboSeeding}
              disabled={seedingCombos}
              className={`w-full font-medium py-2 px-4 rounded-lg transition-colors text-sm ${
                seedingCombos
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {seedingCombos ? 'Seeding...' : 'Seed Database'}
            </button>
          </div>
        </div>

        {/* Seeding Result Details */}
        {seedingResult && (
          <div className={`mb-6 p-6 rounded-2xl border ${
            seedingResult.success
              ? 'bg-green-900/20 border-green-500'
              : 'bg-red-900/20 border-red-500'
          }`}>
            <h3 className={`text-lg font-bold mb-4 ${
              seedingResult.success ? 'text-green-100' : 'text-red-100'
            }`}>
              Risultato Seeding
            </h3>
            
            {seedingResult.success && seedingResult.stats && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-100">
                    {seedingResult.stats.combos_created}
                  </div>
                  <div className="text-green-300 text-sm">Combo create</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-100">
                    {seedingResult.stats.cards_created}
                  </div>
                  <div className="text-green-300 text-sm">Carte create</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-100">
                    {seedingResult.stats.relationships_created}
                  </div>
                  <div className="text-green-300 text-sm">Relazioni</div>
                </div>
              </div>
            )}
            
            {seedingResult.errors && seedingResult.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-red-200 font-medium mb-2">Errori:</h4>
                <div className="bg-red-900/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {seedingResult.errors.map((error, i) => (
                    <div key={i} className="text-red-200 text-sm mb-1">{error}</div>
                  ))}
                </div>
              </div>
            )}
            
            {seedingResult.log && seedingResult.log.length > 0 && (
              <div>
                <h4 className={`font-medium mb-2 ${
                  seedingResult.success ? 'text-green-200' : 'text-red-200'
                }`}>
                  Log dettagliato:
                </h4>
                <div className={`rounded-lg p-3 max-h-48 overflow-y-auto text-sm ${
                  seedingResult.success ? 'bg-green-900/30' : 'bg-red-900/30'
                }`}>
                  {seedingResult.log.map((logEntry, i) => (
                    <div key={i} className={`mb-1 ${
                      seedingResult.success ? 'text-green-100' : 'text-red-100'
                    }`}>
                      {logEntry}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Logs */}
        {info?.logs && (
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Log Recenti</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {info.logs.map((log: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-700 rounded text-sm">
                  <div className="flex items-center space-x-3">
                    <span className={`w-2 h-2 rounded-full ${
                      log.action.includes('error') ? 'bg-red-500' : 'bg-green-500'
                    }`}></span>
                    <span className="text-gray-300">{log.message}</span>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(log.created_at).toLocaleString('it-IT')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}