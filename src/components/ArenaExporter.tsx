// src/components/ArenaExporter.tsx
'use client'
import { useState } from 'react'
import { DeckCard, ArenaExportOptions, validateDeck, generateDeckStats } from '../lib/arena-export'
import { useArenaExport } from '../hooks/useArenaExport'

interface ArenaExporterProps {
  deck: DeckCard[]
  sideboard?: DeckCard[]
  filename?: string
  format?: 'standard' | 'historic' | 'brawl'
  className?: string
  showPreview?: boolean
  showStats?: boolean
}

export default function ArenaExporter({
  deck,
  sideboard = [],
  filename = 'mtg-deck',
  format = 'standard',
  className = '',
  showPreview = true,
  showStats = false
}: ArenaExporterProps) {
  const { exportToClipboard, exportToFile, getExportPreview, isExporting } = useArenaExport()
  const [showOptions, setShowOptions] = useState(false)
  const [exportOptions, setExportOptions] = useState<ArenaExportOptions>({
    sortCards: true,
    validateDeck: true,
    includeSideboard: sideboard.length > 0,
    format
  })
  const [copySuccess, setCopySuccess] = useState(false)

  const handleClipboardExport = async () => {
    const result = await exportToClipboard(deck, sideboard, exportOptions)
    if (result.success) {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleFileExport = () => {
    exportToFile(deck, filename, sideboard, exportOptions)
  }

  const previewText = getExportPreview(deck, sideboard, exportOptions)
  const validation = validateDeck(deck, format)
  const stats = showStats ? generateDeckStats(deck) : null

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Export per MTG Arena</h3>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          {showOptions ? 'Nascondi' : 'Opzioni'}
        </button>
      </div>

      {/* Export Options */}
      {showOptions && (
        <div className="bg-gray-700 rounded-lg p-3 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.sortCards}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  sortCards: e.target.checked
                }))}
                className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span className="text-sm text-gray-300">Ordina carte</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.validateDeck}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  validateDeck: e.target.checked
                }))}
                className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span className="text-sm text-gray-300">Valida deck</span>
            </label>
          </div>

          {sideboard.length > 0 && (
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeSideboard}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  includeSideboard: e.target.checked
                }))}
                className="mr-2 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span className="text-sm text-gray-300">Includi sideboard</span>
            </label>
          )}
        </div>
      )}

      {/* Validation Status */}
      {!validation.isValid && exportOptions.validateDeck && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
          <div className="text-yellow-400 font-medium mb-2">Avvisi deck:</div>
          <ul className="text-sm text-yellow-300 space-y-1">
            {validation.warnings.map((warning, i) => (
              <li key={i}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      {showStats && stats && (
        <div className="bg-gray-700 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div>
              <div className="text-xl font-bold text-white">{stats.totalCards}</div>
              <div className="text-xs text-gray-400">Carte</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-400">
                {Object.keys(stats.colorDistribution).length}
              </div>
              <div className="text-xs text-gray-400">Colori</div>
            </div>
            <div>
              <div className="text-xl font-bold text-green-400">
                {stats.totalCards > 0 ? Math.round(
                  Object.entries(stats.manaCurve).reduce((sum, [mana, count]) => 
                    sum + (parseInt(mana) * count), 0) / stats.totalCards * 100
                ) / 100 : 0}
              </div>
              <div className="text-xs text-gray-400">CMC Medio</div>
            </div>
          </div>

          {/* Mana Curve */}
          <div className="text-xs text-gray-400 mb-1">Curva Mana:</div>
          <div className="flex items-end space-x-1 h-12">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(cost => {
              const count = stats.manaCurve[cost] || 0
              const maxCount = Math.max(...Object.values(stats.manaCurve), 1)
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0
              
              return (
                <div key={cost} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                  <div className="text-xs text-gray-400 mt-1">{cost}{cost === 7 ? '+' : ''}</div>
                  <div className="text-xs text-white">{count}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Export Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleClipboardExport}
          disabled={isExporting || deck.length === 0}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
            copySuccess
              ? 'bg-green-600 text-white'
              : 'bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-600 disabled:text-gray-400'
          }`}
        >
          {isExporting ? 'Esportando...' : copySuccess ? 'Copiato!' : 'Copia negli Appunti'}
        </button>

        <button
          onClick={handleFileExport}
          disabled={isExporting || deck.length === 0}
          className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-700 disabled:text-gray-500"
        >
          Salva File
        </button>
      </div>

      {/* Preview */}
      {showPreview && previewText && (
        <div>
          <div className="text-sm font-medium text-gray-300 mb-2">
            Anteprima ({validation.totalCards} carte):
          </div>
          <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
            <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
              {previewText.slice(0, 1000)}
              {previewText.length > 1000 && '\n... (troncato)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}