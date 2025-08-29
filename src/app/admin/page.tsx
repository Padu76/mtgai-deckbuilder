// Aggiornamento per src/app/admin/page.tsx
'use client'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [status, setStatus] = useState<string>('')
  const [allowed, setAllowed] = useState<boolean>(false)
  const [keyInput, setKeyInput] = useState<string>('')
  const [keyParam, setKeyParam] = useState<string>('')
  const [info, setInfo] = useState<any|null>(null)
  const [comboStats, setComboStats] = useState<any|null>(null)
  const [syncingCards, setSyncingCards] = useState(false)
  const [syncingCombos, setSyncingCombos] = useState(false)

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
          lastSync: 'N/D' // We could add this to admin_logs
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

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔐</span>
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

        {/* Main Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Cards Sync */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
                <span className="text-xl">🃏</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Sincronizzazione Carte</h3>
                <p className="text-gray-400 text-sm">Aggiorna database da Scryfall</p>
              </div>
            </div>
            
            {info && (
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Carte totali</div>
                    <div className="text-white font-medium">{info.total_cards?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Carte Arena</div>
                    <div className="text-white font-medium">{info.total_arena?.toLocaleString()}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-400">Ultimo sync</div>
                    <div className="text-white font-medium">
                      {info.last_sync_at ? new Date(info.last_sync_at).toLocaleString('it-IT') : 'Mai'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={runCardsSync}
              disabled={syncingCards}
              className={`w-full font-medium py-3 px-4 rounded-lg transition-colors ${
                syncingCards
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {syncingCards ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-white rounded-full mr-2"></div>
                  Sincronizzando...
                </div>
              ) : (
                'Sync Carte Scryfall'
              )}
            </button>
          </div>

          {/* Combo Sync */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mr-4">
                <span className="text-xl">💫</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Sincronizzazione Combo</h3>
                <p className="text-gray-400 text-sm">Importa da Commander Spellbook</p>
              </div>
            </div>
            
            {comboStats && (
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Combo totali</span>
                    <span className="text-white font-medium">{comboStats.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Ultimo sync</span>
                    <span className="text-white font-medium">{comboStats.lastSync}</span>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={runComboSync}
              disabled={syncingCombos}
              className={`w-full font-medium py-3 px-4 rounded-lg transition-colors ${
                syncingCombos
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {syncingCombos ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-white rounded-full mr-2"></div>
                  Sincronizzando...
                </div>
              ) : (
                'Sync Combo Database'
              )}
            </button>
          </div>
        </div>

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