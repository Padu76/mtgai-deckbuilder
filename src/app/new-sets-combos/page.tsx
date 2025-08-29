// src/app/new-sets-combos/page.tsx
// Pagina con pulsanti Add to Deck e integrazione workspace

'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useDeckWorkspace } from '../../components/DeckWorkspaceContext'

interface RecentSet {
  code: string
  name: string
  released_at: string
  set_type: string
  icon_svg_uri?: string
}

interface NewSetsResult {
  success: boolean
  message: string
  stats?: {
    new_cards_analyzed: number
    existing_cards_matched: number
    internal_combos: number
    cross_combos: number
    total_combos_created: number
  }
  sets_analyzed?: string[]
  log?: string[]
  errors?: string[]
}

interface ComboResult {
  id: string
  name: string
  result_tag: string
  steps: string
  color_identity: string[]
  source: string
  cards?: {
    id: string
    name: string
    image_url?: string
    mana_cost?: string
    types?: string[]
    colors?: string[]
    set?: string
  }[]
}

export default function NewSetsCombosPage() {
  const [recentSets, setRecentSets] = useState<RecentSet[]>([])
  const [selectedExpansions, setSelectedExpansions] = useState<number>(3)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingSets, setIsLoadingSets] = useState(true)
  const [analysisResult, setAnalysisResult] = useState<NewSetsResult | null>(null)
  const [discoveredCombos, setDiscoveredCombos] = useState<ComboResult[]>([])
  const [filterType, setFilterType] = useState<'all' | 'internal' | 'cross'>('all')
  const [showLogs, setShowLogs] = useState(false)
  const [addedCombos, setAddedCombos] = useState<Set<string>>(new Set())

  const { addCardsFromCombo, workspace, isWorkspaceEmpty, getCardStats } = useDeckWorkspace()

  useEffect(() => {
    loadRecentSets()
    loadExistingNewSetsCombos()
  }, [])

  const loadRecentSets = async () => {
    try {
      setIsLoadingSets(true)
      const response = await fetch('https://api.scryfall.com/sets', {
        headers: { 'User-Agent': 'MTGArenaAI-DeckBuilder/1.0' }
      })
      
      if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.status}`)
      }
      
      const data = await response.json()
      const today = new Date()
      
      const threeYearsAgo = new Date()
      threeYearsAgo.setFullYear(today.getFullYear() - 3)
      
      const expansionSets = data.data
        .filter((set: any) => {
          const releaseDate = new Date(set.released_at)
          return set.set_type === 'expansion' && 
                 releaseDate >= threeYearsAgo && 
                 releaseDate <= today
        })
        .sort((a: any, b: any) => 
          new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
        )
        .slice(0, 10)
      
      setRecentSets(expansionSets)
    } catch (error) {
      console.error('Error loading recent sets:', error)
      setRecentSets([
        { code: 'otj', name: 'Outlaws of Thunder Junction', released_at: '2024-04-19', set_type: 'expansion' },
        { code: 'mkm', name: 'Murders at Karlov Manor', released_at: '2024-02-09', set_type: 'expansion' },
        { code: 'lci', name: 'The Lost Caverns of Ixalan', released_at: '2023-11-17', set_type: 'expansion' },
        { code: 'woe', name: 'Wilds of Eldraine', released_at: '2023-09-08', set_type: 'expansion' },
        { code: 'ltr', name: 'The Lord of the Rings', released_at: '2023-06-23', set_type: 'expansion' }
      ])
    } finally {
      setIsLoadingSets(false)
    }
  }

  const loadExistingNewSetsCombos = async () => {
    try {
      const response = await fetch('/api/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '',
          filters: {
            source: ['new_set_analysis', 'scryfall_aggressive']
          }
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setDiscoveredCombos(data.combos || [])
      }
    } catch (error) {
      console.error('Error loading existing combos:', error)
    }
  }

  const handleAnalyzeNewSets = async () => {
    setIsAnalyzing(true)
    setAnalysisResult(null)
    
    try {
      const response = await fetch('/api/admin/analyze-new-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminKey: process.env.NEXT_PUBLIC_ADMIN_KEY,
          expansionsCount: selectedExpansions
        })
      })
      
      const data = await response.json()
      setAnalysisResult(data)
      
      if (data.success) {
        await loadExistingNewSetsCombos()
      }
      
    } catch (error) {
      setAnalysisResult({
        success: false,
        message: `Errore di connessione: ${error}`
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddComboToDeck = (combo: ComboResult) => {
    if (!combo.cards || combo.cards.length === 0) return
    
    const cards = combo.cards.map(card => ({
      id: card.id,
      name: card.name,
      mana_cost: card.mana_cost,
      types: card.types,
      image_url: card.image_url,
      colors: card.colors
    }))
    
    addCardsFromCombo(combo.id, combo.name, cards)
    setAddedCombos(prev => new Set(prev).add(combo.id))
    
    // Remove from added set after 3 seconds to allow re-adding
    setTimeout(() => {
      setAddedCombos(prev => {
        const newSet = new Set(prev)
        newSet.delete(combo.id)
        return newSet
      })
    }, 3000)
  }

  const filteredCombos = discoveredCombos.filter(combo => {
    if (filterType === 'all') return true
    if (filterType === 'internal') return combo.source === 'new_set_analysis' && !combo.name.includes('existing')
    if (filterType === 'cross') return combo.name.includes('existing') || combo.steps.includes('cross')
    return true
  })

  const getColorBadgeClass = (colors: string[]) => {
    if (colors.length === 0) return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    if (colors.length === 1) {
      const colorMap: {[key: string]: string} = {
        'W': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'U': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'B': 'bg-gray-800/20 text-gray-300 border-gray-500/30',
        'R': 'bg-red-500/20 text-red-400 border-red-500/30',
        'G': 'bg-green-500/20 text-green-400 border-green-500/30'
      }
      return colorMap[colors[0]] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', { 
      year: 'numeric', 
      month: 'short' 
    })
  }

  const cardStats = getCardStats()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Workspace Info */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white mb-4 transition-colors">
            ← Torna alla Homepage
          </Link>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-3xl">🔥</span>
            <h1 className="text-4xl font-bold">Combo delle Nuove Espansioni</h1>
            <span className="text-3xl">🔥</span>
          </div>
          
          <p className="text-gray-400 max-w-3xl mx-auto mb-4">
            Scopri combo innovative dalle ultime espansioni di Magic. L'AI analizza automaticamente 
            come le nuove carte si combinano tra loro e con quelle esistenti per creare sinergie mai viste prima.
          </p>

          {/* Workspace Status */}
          {!isWorkspaceEmpty && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 max-w-md mx-auto">
              <p className="text-green-400 text-sm">
                Deck Workspace: <span className="font-bold">{workspace?.name}</span> - {cardStats.total} carte
              </p>
            </div>
          )}
        </div>

        {/* Analysis Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Configurazione Analisi</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Numero di Espansioni da Analizzare
              </label>
              <select 
                value={selectedExpansions}
                onChange={(e) => setSelectedExpansions(Number(e.target.value))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                disabled={isAnalyzing}
              >
                <option value={1}>Ultima espansione</option>
                <option value={2}>Ultime 2 espansioni</option>
                <option value={3}>Ultime 3 espansioni</option>
                <option value={4}>Ultime 4 espansioni</option>
                <option value={5}>Ultime 5 espansioni</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Espansioni da Analizzare
              </label>
              {isLoadingSets ? (
                <div className="flex items-center justify-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span className="ml-2 text-sm text-gray-400">Caricando sets...</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-20 overflow-y-auto">
                  {recentSets.slice(0, selectedExpansions).map((set, index) => (
                    <div key={set.code} className="flex items-center justify-between text-sm bg-gray-700/50 rounded p-2">
                      <div>
                        <span className="text-gray-300 font-medium">{set.name}</span>
                        <div className="text-gray-500 text-xs">
                          {set.code.toUpperCase()} • {formatDate(set.released_at)}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? 'bg-green-400' : index === 1 ? 'bg-yellow-400' : 'bg-blue-400'
                      }`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAnalyzeNewSets}
                disabled={isAnalyzing || isLoadingSets}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-medium py-3 px-6 rounded-lg hover:from-red-700 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Analizzando...
                  </div>
                ) : (
                  `Analizza ${selectedExpansions} Espansioni`
                )}
              </button>
            </div>
          </div>

          {!isLoadingSets && recentSets.length > 0 && (
            <div className="mt-4 p-3 bg-gray-700/30 rounded">
              <p className="text-sm text-gray-400">
                Trovate {recentSets.length} espansioni recenti. 
                L'ultima: <span className="text-white font-medium">{recentSets[0]?.name}</span> 
                ({formatDate(recentSets[0]?.released_at)})
              </p>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {analysisResult && (
          <div className={`rounded-lg p-6 mb-8 ${
            analysisResult.success 
              ? 'bg-green-900/30 border border-green-500' 
              : 'bg-red-900/30 border border-red-500'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {analysisResult.success ? 'Analisi Completata' : 'Errore nell\'Analisi'}
              </h3>
              {analysisResult.log && (
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {showLogs ? 'Nascondi Log' : 'Mostra Log'}
                </button>
              )}
            </div>
            
            <p className={analysisResult.success ? 'text-green-400' : 'text-red-400'}>
              {analysisResult.message}
            </p>
            
            {analysisResult.success && analysisResult.stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">
                    {analysisResult.stats.total_combos_created}
                  </div>
                  <div className="text-xs text-gray-400">Combo Create</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {analysisResult.stats.new_cards_analyzed}
                  </div>
                  <div className="text-xs text-gray-400">Nuove Carte</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {analysisResult.stats.internal_combos}
                  </div>
                  <div className="text-xs text-gray-400">Combo Interne</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">
                    {analysisResult.stats.cross_combos}
                  </div>
                  <div className="text-xs text-gray-400">Combo Cross</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {analysisResult.stats.existing_cards_matched}
                  </div>
                  <div className="text-xs text-gray-400">Carte Esistenti</div>
                </div>
              </div>
            )}

            {analysisResult.sets_analyzed && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Set Analizzati:</h4>
                <div className="flex gap-2 flex-wrap">
                  {analysisResult.sets_analyzed.map(setCode => (
                    <span key={setCode} className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
                      {setCode.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {showLogs && analysisResult.log && (
              <div className="mt-4 bg-gray-800/50 rounded p-3">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Log Dettagliato:</h4>
                <div className="text-xs text-gray-400 space-y-1 max-h-40 overflow-y-auto">
                  {analysisResult.log.map((logEntry, index) => (
                    <div key={index}>{logEntry}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Combo Filters */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Combo Scoperte</h2>
            <p className="text-gray-400">
              {filteredCombos.length} combo trovate dalle nuove espansioni
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filterType === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Tutte ({discoveredCombos.length})
            </button>
            <button
              onClick={() => setFilterType('internal')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filterType === 'internal' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Interne
            </button>
            <button
              onClick={() => setFilterType('cross')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filterType === 'cross' 
                  ? 'bg-cyan-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Cross-Set
            </button>
          </div>
        </div>

        {/* Combo Results Grid */}
        {filteredCombos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">Nessuna combo trovata</h3>
            <p className="text-gray-400 mb-6">
              {discoveredCombos.length === 0 
                ? 'Esegui un\'analisi per scoprire nuove combo dalle espansioni recenti.'
                : `Nessuna combo ${filterType} trovata. Prova un filtro diverso.`
              }
            </p>
            {discoveredCombos.length === 0 && (
              <button
                onClick={handleAnalyzeNewSets}
                disabled={isLoadingSets}
                className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-orange-700 transition-all disabled:opacity-50"
              >
                Inizia Analisi
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCombos.map((combo) => (
              <div key={combo.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{combo.name}</h3>
                    <p className="text-sm text-gray-400">{combo.result_tag}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs border ${getColorBadgeClass(combo.color_identity)}`}>
                    {combo.color_identity.length === 0 ? 'Colorless' : combo.color_identity.join('')}
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {combo.steps.split('.')[0]}...
                  </p>
                  {combo.cards && combo.cards.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">{combo.cards.length} carte:</p>
                      <div className="flex flex-wrap gap-1">
                        {combo.cards.map(card => (
                          <span key={card.id} className="text-xs bg-gray-700 px-2 py-1 rounded">
                            {card.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      combo.source === 'new_set_analysis' 
                        ? 'bg-orange-500/20 text-orange-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {combo.source === 'new_set_analysis' ? 'New Set' : 'AI Pattern'}
                    </span>
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAddComboToDeck(combo)}
                      disabled={!combo.cards || combo.cards.length === 0}
                      className={`px-3 py-1 text-xs rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        addedCombos.has(combo.id)
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {addedCombos.has(combo.id) ? 'Aggiunta!' : 'Add to Deck'}
                    </button>
                    
                    <Link href={`/combos/${combo.id}`}>
                      <button className="text-blue-400 hover:text-blue-300 text-xs transition-colors px-2 py-1 border border-blue-400/30 rounded hover:border-blue-300/50">
                        Dettagli
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">Come Funziona l'Analisi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div>
              <h4 className="font-medium text-white mb-2">Combo Interne</h4>
              <p>
                L'AI analizza le nuove carte all'interno della stessa espansione per trovare 
                sinergie progettate dai designer, come interazioni tribali o meccaniche innovative.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Combo Cross-Set</h4>
              <p>
                Le nuove carte vengono confrontate con il database esistente per scoprire 
                combinazioni mai viste prima che potrebbero rivoluzionare il meta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}