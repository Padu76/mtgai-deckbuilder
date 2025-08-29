// src/app/combos/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Combo {
  id: string
  name: string
  source: string
  result_tag: string
  color_identity: string[]
  steps: string
  cards: {
    id: string
    name: string
    image_uris?: any
    image_url?: string
    mana_cost?: string
    types?: string[]
  }[]
}

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    colors: [] as string[],
    format: 'all' as 'all' | 'standard' | 'historic' | 'brawl',
    resultType: 'all' as string,
    search: ''
  })

  const colorOptions = [
    { code: 'W', name: 'Bianco', symbol: '⚪' },
    { code: 'U', name: 'Blu', symbol: '🔵' },
    { code: 'B', name: 'Nero', symbol: '⚫' },
    { code: 'R', name: 'Rosso', symbol: '🔴' },
    { code: 'G', name: 'Verde', symbol: '🟢' }
  ]

  const resultTypes = [
    'Infinite Mana',
    'Infinite Tokens', 
    'Infinite Damage',
    'Infinite Life',
    'Infinite Mill',
    'Infinite Draw',
    'Win Condition',
    'Lock/Stax'
  ]

  useEffect(() => {
    fetchCombos()
  }, [filters])

  const fetchCombos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.colors.length > 0) params.set('colors', filters.colors.join(','))
      if (filters.format !== 'all') params.set('format', filters.format)
      if (filters.resultType !== 'all') params.set('result_type', filters.resultType)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/combos?${params}`)
      const data = await response.json()
      
      if (data.ok) {
        setCombos(data.combos || [])
      }
    } catch (error) {
      console.error('Error fetching combos:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleColor = (color: string) => {
    setFilters(prev => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter(c => c !== color)
        : [...prev.colors, color]
    }))
  }

  const clearFilters = () => {
    setFilters({
      colors: [],
      format: 'all',
      resultType: 'all',
      search: ''
    })
  }

  const buildDeckFromCombo = async (combo: Combo) => {
    try {
      const response = await fetch('/api/build/from-combo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combo_id: combo.id,
          format: filters.format === 'all' ? 'historic' : filters.format
        })
      })
      
      const data = await response.json()
      if (data.ok) {
        window.location.href = `/deck/${data.deck_id}`
      }
    } catch (error) {
      console.error('Error building deck from combo:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                ← Home
              </Link>
              <h1 className="text-xl font-bold text-white">Database Combo</h1>
            </div>
            
            <div className="text-sm text-gray-400">
              {combos.length} combo trovate
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Esplora le 
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent ml-2">
              Combo Infinite
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Scopri le migliori sinergie per MTG Arena. Ogni combo include le carte necessarie 
            e può generare automaticamente un deck competitivo.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search */}
            <div className="flex-1 lg:max-w-md">
              <input
                type="text"
                placeholder="Cerca combo per nome o carta..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Format filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-300">Formato:</label>
              <select
                value={filters.format}
                onChange={(e) => setFilters(prev => ({ ...prev, format: e.target.value as any }))}
                className="bg-gray-900 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="all">Tutti</option>
                <option value="standard">Standard</option>
                <option value="historic">Historic</option>
                <option value="brawl">Historic Brawl</option>
              </select>
            </div>

            {/* Clear filters */}
            <button
              onClick={clearFilters}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
            >
              Pulisci filtri
            </button>
          </div>

          {/* Color filters */}
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-300">Colori:</span>
              {colorOptions.map(color => (
                <button
                  key={color.code}
                  onClick={() => toggleColor(color.code)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all transform hover:scale-105
                    ${filters.colors.includes(color.code)
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                >
                  {color.symbol} {color.name}
                </button>
              ))}
            </div>
          </div>

          {/* Result type filter */}
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-300">Risultato:</span>
              <select
                value={filters.resultType}
                onChange={(e) => setFilters(prev => ({ ...prev, resultType: e.target.value }))}
                className="bg-gray-900 text-white px-3 py-1 rounded border border-gray-600 focus:border-purple-500 focus:outline-none text-sm"
              >
                <option value="all">Tutti i tipi</option>
                {resultTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded mb-4"></div>
                <div className="h-4 bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-700 rounded mb-4 w-3/4"></div>
                <div className="flex space-x-2">
                  <div className="w-12 h-16 bg-gray-700 rounded"></div>
                  <div className="w-12 h-16 bg-gray-700 rounded"></div>
                  <div className="w-12 h-16 bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : combos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-white mb-2">Nessuna combo trovata</h3>
            <p className="text-gray-400 mb-6">
              Prova a modificare i filtri o la ricerca
            </p>
            <button
              onClick={clearFilters}
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Mostra tutte le combo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combos.map(combo => (
              <div 
                key={combo.id}
                className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 overflow-hidden transition-all duration-200 hover:scale-105 hover:shadow-xl"
              >
                {/* Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-white text-lg leading-tight">
                      {combo.name}
                    </h3>
                    <div className="flex space-x-1">
                      {combo.color_identity.map(color => (
                        <span key={color} className="text-sm">
                          {colorOptions.find(c => c.code === color)?.symbol}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-400 mb-4">
                    <span className="bg-purple-600/20 text-purple-400 px-2 py-1 rounded text-xs font-medium">
                      {combo.result_tag}
                    </span>
                    <span>Fonte: {combo.source}</span>
                  </div>

                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    {combo.steps}
                  </p>
                </div>

                {/* Cards */}
                <div className="px-6 pb-4">
                  <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                    {combo.cards.map(card => (
                      <div key={card.id} className="flex-shrink-0">
                        <div className="w-16 h-20 bg-gray-700 rounded border-2 border-purple-500/20 flex flex-col items-center justify-center text-center p-1 hover:scale-110 transition-transform cursor-pointer">
                          <div className="text-xs text-white font-medium leading-tight mb-1">
                            {card.name.length > 12 ? card.name.slice(0, 10) + '...' : card.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {card.mana_cost ? card.mana_cost.replace(/[{}]/g, '') : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => buildDeckFromCombo(combo)}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                      Crea Deck
                    </button>
                    <button className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium py-2 px-4 rounded-lg transition-colors">
                      Dettagli
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {combos.length > 0 && (
          <div className="mt-16 bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-purple-400 mb-1">
                  {combos.length}
                </div>
                <div className="text-gray-300 text-sm">Combo Totali</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-pink-400 mb-1">
                  {new Set(combos.flatMap(c => c.color_identity)).size}
                </div>
                <div className="text-gray-300 text-sm">Combinazioni Colori</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-400 mb-1">
                  {new Set(combos.map(c => c.result_tag)).size}
                </div>
                <div className="text-gray-300 text-sm">Tipi Risultato</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-400 mb-1">
                  Arena
                </div>
                <div className="text-gray-300 text-sm">Compatibile</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}