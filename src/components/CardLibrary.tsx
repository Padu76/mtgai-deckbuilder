// src/components/CardLibrary.tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import CardPreview from './CardPreview'

interface Card {
  id: string
  name: string
  mana_cost?: string
  mana_value?: number
  colors?: string[]
  color_identity?: string[]
  types?: string[]
  oracle_text?: string
  rarity?: string
  set_code?: string
  legal_standard?: boolean
  legal_historic?: boolean
  legal_brawl?: boolean
  tags?: string[]
  image_uris?: any
  image_url?: string
}

interface CardLibraryProps {
  format: 'standard' | 'historic' | 'brawl'
  onCardAdd?: (card: Card, quantity: number) => void
  selectedColors?: string[]
  commanderColorIdentity?: string[]
  className?: string
}

export default function CardLibrary({ 
  format, 
  onCardAdd, 
  selectedColors = [],
  commanderColorIdentity = [],
  className = ''
}: CardLibraryProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    colors: [] as string[],
    types: [] as string[],
    rarity: [] as string[],
    cmc: { min: 0, max: 20 },
    tags: [] as string[]
  })
  const [sortBy, setSortBy] = useState<'name' | 'cmc' | 'rarity'>('name')
  const [page, setPage] = useState(1)
  const cardsPerPage = 48

  const colorOptions = [
    { code: 'W', name: 'Bianco', symbol: '⚪' },
    { code: 'U', name: 'Blu', symbol: '🔵' },
    { code: 'B', name: 'Nero', symbol: '⚫' },
    { code: 'R', name: 'Rosso', symbol: '🔴' },
    { code: 'G', name: 'Verde', symbol: '🟢' },
    { code: 'C', name: 'Incolore', symbol: '◇' }
  ]

  const typeOptions = [
    'Creature', 'Instant', 'Sorcery', 'Enchantment', 
    'Artifact', 'Planeswalker', 'Land', 'Battle'
  ]

  const rarityOptions = [
    { code: 'common', name: 'Comune' },
    { code: 'uncommon', name: 'Non comune' },
    { code: 'rare', name: 'Rara' },
    { code: 'mythic', name: 'Mitica' }
  ]

  const tagOptions = [
    'lifegain', 'treasures', 'tokens', 'counters', 'removal',
    'draw', 'ramp', 'sacrifice', 'graveyard', 'spells-matter',
    'creatures-matter', 'artifacts-matter', 'enchantments-matter'
  ]

  // Fetch cards when filters change
  useEffect(() => {
    fetchCards()
  }, [format, filters, search, sortBy])

  const fetchCards = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        format,
        sort: sortBy,
        limit: '1000'
      })
      
      if (search.trim()) params.append('search', search.trim())
      if (filters.colors.length > 0) params.append('colors', filters.colors.join(','))
      if (filters.types.length > 0) params.append('types', filters.types.join(','))
      if (filters.rarity.length > 0) params.append('rarity', filters.rarity.join(','))
      if (filters.cmc.min > 0) params.append('cmc_min', filters.cmc.min.toString())
      if (filters.cmc.max < 20) params.append('cmc_max', filters.cmc.max.toString())
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','))

      const res = await fetch(`/api/cards?${params}`)
      const data = await res.json()
      
      if (data.ok) {
        setCards(data.cards || [])
      } else {
        console.error('Error fetching cards:', data.error)
        setCards([])
      }
    } catch (error) {
      console.error('Error fetching cards:', error)
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  // Filter cards for commander color identity in Brawl
  const filteredCards = useMemo(() => {
    let filtered = cards

    if (format === 'brawl' && commanderColorIdentity.length > 0) {
      filtered = filtered.filter(card => {
        // In Brawl, le carte devono rispettare l'identità di colore del comandante
        return (card.color_identity || []).every(color => 
          commanderColorIdentity.includes(color)
        )
      })
    }

    return filtered
  }, [cards, format, commanderColorIdentity])

  // Paginated cards
  const paginatedCards = useMemo(() => {
    const startIndex = (page - 1) * cardsPerPage
    return filteredCards.slice(startIndex, startIndex + cardsPerPage)
  }, [filteredCards, page])

  const totalPages = Math.ceil(filteredCards.length / cardsPerPage)

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: Array.isArray(prev[category]) 
        ? (prev[category] as string[]).includes(value)
          ? (prev[category] as string[]).filter((v: string) => v !== value)
          : [...(prev[category] as string[]), value]
        : prev[category]
    }))
    setPage(1)
  }

  const handleCmcChange = (type: 'min' | 'max', value: number) => {
    setFilters(prev => ({
      ...prev,
      cmc: { ...prev.cmc, [type]: value }
    }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({
      colors: [],
      types: [],
      rarity: [],
      cmc: { min: 0, max: 20 },
      tags: []
    })
    setSearch('')
    setPage(1)
  }

  const handleCardAdd = (card: Card) => {
    if (onCardAdd) {
      // In Brawl le carte sono singleton (max 1), in Standard max 4
      const maxQuantity = format === 'brawl' ? 1 : 4
      onCardAdd(card, 1)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <input
          type="text"
          placeholder="Cerca carte per nome..."
          value={search}
          onChange={(e) => {setSearch(e.target.value); setPage(1)}}
          className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {/* Filters */}
      <div className="bg-gray-800 p-4 rounded-lg space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-white font-semibold">Filtri</h3>
          <button 
            onClick={clearFilters}
            className="text-orange-400 hover:text-orange-300 text-sm transition-colors"
          >
            Pulisci tutto
          </button>
        </div>

        {/* Colors */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Colori</label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map(color => (
              <button
                key={color.code}
                onClick={() => toggleFilter('colors', color.code)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filters.colors.includes(color.code)
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {color.symbol} {color.name}
              </button>
            ))}
          </div>
        </div>

        {/* Types */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Tipi</label>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map(type => (
              <button
                key={type}
                onClick={() => toggleFilter('types', type)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filters.types.includes(type)
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Rarity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Rarità</label>
          <div className="flex flex-wrap gap-2">
            {rarityOptions.map(rarity => (
              <button
                key={rarity.code}
                onClick={() => toggleFilter('rarity', rarity.code)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filters.rarity.includes(rarity.code)
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {rarity.name}
              </button>
            ))}
          </div>
        </div>

        {/* CMC Range */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Costo di Mana</label>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-400">Min:</label>
              <input
                type="number"
                min="0"
                max="20"
                value={filters.cmc.min}
                onChange={(e) => handleCmcChange('min', parseInt(e.target.value) || 0)}
                className="w-16 bg-gray-900 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-400">Max:</label>
              <input
                type="number"
                min="0"
                max="20"
                value={filters.cmc.max}
                onChange={(e) => handleCmcChange('max', parseInt(e.target.value) || 20)}
                className="w-16 bg-gray-900 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Ordina per</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-gray-900 text-white px-3 py-2 rounded border border-gray-600 focus:border-orange-500 focus:outline-none"
          >
            <option value="name">Nome</option>
            <option value="cmc">Costo di Mana</option>
            <option value="rarity">Rarità</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-300">
            {loading ? 'Caricamento...' : `${filteredCards.length} carte trovate`}
          </span>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 hover:bg-gray-600 transition-colors"
              >
                ‹
              </button>
              <span className="text-gray-300 text-sm">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 hover:bg-gray-600 transition-colors"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-pulse">Caricamento carte...</div>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            Nessuna carta trovata con i filtri attuali
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {paginatedCards.map(card => (
              <div key={card.id} className="relative">
                <CardPreview
                  card={card}
                  size="small"
                  className="hover:scale-105 transition-transform"
                  onClick={() => handleCardAdd(card)}
                />
                
                {onCardAdd && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 flex items-center justify-center transition-all rounded-lg">
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity">
                      Aggiungi
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}