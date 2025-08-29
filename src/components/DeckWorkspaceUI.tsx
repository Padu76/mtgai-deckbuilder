// src/components/DeckWorkspaceUI.tsx
// Floating workspace UI component con CardPreview ed export Arena

'use client'
import { useState, useRef } from 'react'
import { useDeckWorkspace } from './DeckWorkspaceContext'

interface DeckWorkspaceUIProps {
  className?: string
}

export default function DeckWorkspaceUI({ className = '' }: DeckWorkspaceUIProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const downloadRef = useRef<HTMLAnchorElement>(null)
  
  const {
    workspace,
    isWorkspaceEmpty,
    getCardStats,
    updateCardQuantity,
    removeCard,
    exportToArena,
    clearWorkspace,
    renameWorkspace
  } = useDeckWorkspace()

  const cardStats = getCardStats()

  const handleExportToArena = () => {
    const deckText = exportToArena()
    if (!deckText) return

    const blob = new Blob([deckText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    if (downloadRef.current) {
      downloadRef.current.href = url
      downloadRef.current.download = `${workspace?.name || 'deck'}.txt`
      downloadRef.current.click()
    }
    
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  const handleCopyToClipboard = () => {
    const deckText = exportToArena()
    if (!deckText) return

    navigator.clipboard.writeText(deckText).then(() => {
      // Show success feedback
      setShowExportModal(false)
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err)
    })
  }

  if (isWorkspaceEmpty) {
    return null // Don't show anything if workspace is empty
  }

  return (
    <>
      {/* Floating Button */}
      <div className={`fixed bottom-6 right-6 z-40 ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-105 border-2 border-blue-500"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
            <span className="font-medium">{cardStats.total}</span>
          </div>
        </button>
      </div>

      {/* Workspace Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-h-96 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-40 overflow-hidden">
          {/* Header */}
          <div className="bg-gray-700 p-4 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{workspace?.name}</h3>
                <p className="text-sm text-gray-400">
                  {cardStats.total} carte ({cardStats.creatures}C, {cardStats.spells}S, {cardStats.lands}L)
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Cards List */}
          <div className="max-h-64 overflow-y-auto p-4 space-y-2">
            {workspace?.cards.map(card => (
              <div key={card.id} className="bg-gray-700 rounded p-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{card.name}</span>
                    {card.mana_cost && (
                      <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                        {card.mana_cost}
                      </span>
                    )}
                  </div>
                  {card.types && card.types.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      {card.types.join(' ')}
                    </div>
                  )}
                  {card.source === 'combo' && card.combo_id && (
                    <div className="text-xs text-blue-400 mt-1">
                      Da combo
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCardQuantity(card.id, card.quantity - 1)}
                      className="w-6 h-6 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
                      disabled={card.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="text-white font-medium w-4 text-center">{card.quantity}</span>
                    <button
                      onClick={() => updateCardQuantity(card.id, card.quantity + 1)}
                      className="w-6 h-6 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
                      disabled={card.quantity >= 4}
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeCard(card.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="bg-gray-700 p-4 border-t border-gray-600 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Export to Arena
              </button>
              <button
                onClick={() => {
                  if (confirm('Vuoi svuotare il workspace?')) {
                    clearWorkspace()
                    setIsOpen(false)
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Export to MTG Arena</h3>
            
            <div className="bg-gray-700 rounded p-3 mb-4 max-h-40 overflow-y-auto">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                {exportToArena()}
              </pre>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Il deck è pronto per l'importazione in MTG Arena. Puoi copiarlo negli appunti o scaricarlo come file .txt.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleCopyToClipboard}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={handleExportToArena}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium"
              >
                Download .txt
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden download link */}
      <a ref={downloadRef} className="hidden" />
    </>
  )
}