// src/components/ManualComboCreator.tsx
'use client'
import { useState } from 'react'

interface Card {
  id: string
  name: string
  colors: string[]
  image_uris?: any
}

interface ManualComboCreatorProps {
  adminKey: string
  onComboAdded?: () => void
}

export default function ManualComboCreator({ adminKey, onComboAdded }: ManualComboCreatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [formData, setFormData] = useState({
    name: '',
    result_tag: 'Win Condition',
    steps: '',
    selectedCards: [] as Card[]
  })

  const resultTypes = [
    'Win Condition',
    'Infinite Mana',
    'Infinite Tokens',
    'Infinite Damage',
    'Infinite Life',
    'Infinite Mill',
    'Infinite Draw',
    'Lock/Stax'
  ]

  const searchCards = async (term: string) => {
    if (term.length < 3) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/cards?search=${encodeURIComponent(term)}&limit=20`)
      const data = await response.json()
      if (data.ok) {
        setSearchResults(data.cards || [])
      }
    } catch (error) {
      console.error('Error searching cards:', error)
    }
  }

  const addCard = (card: Card) => {
    if (!formData.selectedCards.find(c => c.id === card.id)) {
      setFormData(prev => ({
        ...prev,
        selectedCards: [...prev.selectedCards, card]
      }))
    }
    setSearchTerm('')
    setSearchResults([])
  }

  const removeCard = (cardId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedCards: prev.selectedCards.filter(c => c.id !== cardId)
    }))
  }

  const calculateColorIdentity = () => {
    const colors = new Set<string>()
    formData.selectedCards.forEach(card => {
      card.colors.forEach(color => colors.add(color))
    })
    return Array.from(colors).sort()
  }

  const handleSubmit = async () => {
    if (!formData.name || formData.selectedCards.length === 0 || !formData.steps) {
      alert('Nome, carte e passi sono obbligatori')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/combos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          name: formData.name,
          result_tag: formData.result_tag,
          steps: formData.steps,
          cards: formData.selectedCards.map(c => c.id),
          color_identity: calculateColorIdentity(),
          source: 'Manual'
        })
      })

      const data = await response.json()
      if (data.ok) {
        setFormData({
          name: '',
          result_tag: 'Win Condition',
          steps: '',
          selectedCards: []
        })
        setIsOpen(false)
        if (onComboAdded) onComboAdded()
        alert('Combo aggiunta con successo!')
      } else {
        alert('Errore: ' + data.error)
      }
    } catch (error) {
      console.error('Error creating combo:', error)
      alert('Errore durante la creazione della combo')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        + Aggiungi Combo Manuale
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Aggiungi Combo Manualmente</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Nome Combo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nome Combo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="es. Kiki-Jiki + Restoration Angel"
              className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Tipo Risultato */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Risultato</label>
            <select
              value={formData.result_tag}
              onChange={(e) => setFormData(prev => ({ ...prev, result_tag: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 focus:border-green-500 focus:outline-none"
            >
              {resultTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Carte */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Carte ({formData.selectedCards.length})
            </label>
            
            {/* Selected Cards */}
            {formData.selectedCards.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {formData.selectedCards.map(card => (
                  <div
                    key={card.id}
                    className="flex items-center bg-gray-700 rounded-lg px-3 py-2"
                  >
                    <span className="text-white text-sm mr-2">{card.name}</span>
                    <button
                      onClick={() => removeCard(card.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Card Search */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  searchCards(e.target.value)
                }}
                placeholder="Cerca carte per nome..."
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 focus:border-green-500 focus:outline-none"
              />
              
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-gray-900 border border-gray-600 rounded-lg mt-1 max-h-48 overflow-y-auto z-10">
                  {searchResults.map(card => (
                    <button
                      key={card.id}
                      onClick={() => addCard(card)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-700 text-white text-sm"
                    >
                      <div className="font-medium">{card.name}</div>
                      <div className="text-xs text-gray-400">
                        {card.colors.join(', ') || 'Incolore'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="text-xs text-gray-400 mt-1">
              Digita almeno 3 caratteri per cercare
            </div>
          </div>

          {/* Passi */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Passi della Combo</label>
            <textarea
              value={formData.steps}
              onChange={(e) => setFormData(prev => ({ ...prev, steps: e.target.value }))}
              placeholder="Descrivi i passi necessari per eseguire la combo..."
              rows={4}
              className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Color Identity Preview */}
          {formData.selectedCards.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Identità Colore</label>
              <div className="text-white">
                {calculateColorIdentity().join(', ') || 'Incolore'}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.name || formData.selectedCards.length === 0 || !formData.steps}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-white rounded-full mr-2"></div>
                  Creando...
                </div>
              ) : (
                'Crea Combo'
              )}
            </button>
            
            <button
              onClick={() => setIsOpen(false)}
              className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}