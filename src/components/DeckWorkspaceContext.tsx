// src/components/DeckWorkspaceContext.tsx
// Fixed context per gestire il deck workspace globale

'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Card {
  id: string
  name: string
  mana_cost?: string
  types?: string[]
  image_url?: string
  colors?: string[]
}

interface DeckCard extends Card {
  quantity: number
  source: string
  combo_id?: string
  added_at: number
}

interface DeckWorkspace {
  id: string
  name: string
  cards: DeckCard[]
  format: 'standard' | 'historic' | 'brawl'
  created_at: number
  updated_at: number
}

interface DeckWorkspaceContextType {
  workspace: DeckWorkspace | null
  addCardsFromCombo: (comboId: string, comboName: string, cards: Card[]) => void
  addSingleCard: (card: Card, quantity?: number, source?: string) => void
  removeCard: (cardId: string) => void
  updateCardQuantity: (cardId: string, quantity: number) => void
  clearWorkspace: () => void
  createNewWorkspace: (name: string, format: 'standard' | 'historic' | 'brawl') => void
  renameWorkspace: (name: string) => void
  getCardStats: () => { total: number, creatures: number, spells: number, lands: number }
  exportToArena: () => string
  isWorkspaceEmpty: boolean
}

const DeckWorkspaceContext = createContext<DeckWorkspaceContextType | undefined>(undefined)

const STORAGE_KEY = 'mtg-deck-workspace'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function DeckWorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<DeckWorkspace | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setWorkspace(parsed)
      } catch (error) {
        console.error('Error loading workspace:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (workspace) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
    }
  }, [workspace])

  const addCardsFromCombo = (comboId: string, comboName: string, cards: Card[]) => {
    if (!workspace) {
      createNewWorkspace('New Combo Deck', 'historic')
    }

    setWorkspace(prev => {
      if (!prev) return prev

      const now = Date.now()
      const newCards: DeckCard[] = []
      const updatedCards = [...prev.cards]
      
      cards.forEach(card => {
        const existingCardIndex = updatedCards.findIndex(c => c.id === card.id)
        
        if (existingCardIndex >= 0) {
          updatedCards[existingCardIndex].quantity = Math.min(4, updatedCards[existingCardIndex].quantity + 1)
          updatedCards[existingCardIndex].added_at = now
        } else {
          newCards.push({
            ...card,
            quantity: 1,
            source: 'combo',
            combo_id: comboId,
            added_at: now
          })
        }
      })

      return {
        ...prev,
        cards: updatedCards.concat(newCards),
        updated_at: now
      }
    })
  }

  const addSingleCard = (card: Card, quantity: number = 1, source: string = 'manual') => {
    if (!workspace) {
      createNewWorkspace('New Deck', 'historic')
    }

    setWorkspace(prev => {
      if (!prev) return prev

      const now = Date.now()
      const updatedCards = [...prev.cards]
      const existingCardIndex = updatedCards.findIndex(c => c.id === card.id)
      
      if (existingCardIndex >= 0) {
        const newQuantity = Math.min(4, updatedCards[existingCardIndex].quantity + quantity)
        updatedCards[existingCardIndex].quantity = newQuantity
        updatedCards[existingCardIndex].added_at = now
      } else {
        const newCard: DeckCard = {
          ...card,
          quantity: Math.min(4, quantity),
          source,
          added_at: now
        }
        updatedCards.push(newCard)
      }

      return {
        ...prev,
        cards: updatedCards,
        updated_at: now
      }
    })
  }

  const removeCard = (cardId: string) => {
    setWorkspace(prev => {
      if (!prev) return prev

      return {
        ...prev,
        cards: prev.cards.filter(c => c.id !== cardId),
        updated_at: Date.now()
      }
    })
  }

  const updateCardQuantity = (cardId: string, quantity: number) => {
    setWorkspace(prev => {
      if (!prev) return prev

      const updatedCards = [...prev.cards]
      const cardIndex = updatedCards.findIndex(c => c.id === cardId)
      
      if (cardIndex >= 0) {
        if (quantity <= 0) {
          updatedCards.splice(cardIndex, 1)
        } else {
          updatedCards[cardIndex].quantity = Math.min(4, quantity)
          updatedCards[cardIndex].added_at = Date.now()
        }
      }

      return {
        ...prev,
        cards: updatedCards,
        updated_at: Date.now()
      }
    })
  }

  const clearWorkspace = () => {
    localStorage.removeItem(STORAGE_KEY)
    setWorkspace(null)
  }

  const createNewWorkspace = (name: string, format: 'standard' | 'historic' | 'brawl') => {
    const newWorkspace: DeckWorkspace = {
      id: generateId(),
      name,
      cards: [],
      format,
      created_at: Date.now(),
      updated_at: Date.now()
    }
    setWorkspace(newWorkspace)
  }

  const renameWorkspace = (name: string) => {
    setWorkspace(prev => {
      if (!prev) return prev
      return {
        ...prev,
        name,
        updated_at: Date.now()
      }
    })
  }

  const getCardStats = () => {
    if (!workspace) {
      return { total: 0, creatures: 0, spells: 0, lands: 0 }
    }

    let total = 0
    let creatures = 0
    let spells = 0
    let lands = 0

    workspace.cards.forEach(card => {
      total += card.quantity
      const types = card.types || []
      
      if (types.some(type => type.toLowerCase().includes('creature'))) {
        creatures += card.quantity
      } else if (types.some(type => type.toLowerCase().includes('land'))) {
        lands += card.quantity
      } else {
        spells += card.quantity
      }
    })

    return { total, creatures, spells, lands }
  }

  const exportToArena = (): string => {
    if (!workspace || workspace.cards.length === 0) {
      return ''
    }

    const lines: string[] = []
    lines.push('Deck')
    
    const creatures = workspace.cards.filter(card => 
      card.types?.some(type => type.toLowerCase().includes('creature'))
    )
    const spells = workspace.cards.filter(card => 
      card.types?.some(type => 
        !type.toLowerCase().includes('creature') && 
        !type.toLowerCase().includes('land')
      )
    )
    const lands = workspace.cards.filter(card => 
      card.types?.some(type => type.toLowerCase().includes('land'))
    )

    const allCards = creatures.concat(spells).concat(lands)
    allCards.forEach(card => {
      lines.push(`${card.quantity} ${card.name}`)
    })

    return lines.join('\n')
  }

  const isWorkspaceEmpty = !workspace || workspace.cards.length === 0

  return (
    <DeckWorkspaceContext.Provider value={{
      workspace,
      addCardsFromCombo,
      addSingleCard,
      removeCard,
      updateCardQuantity,
      clearWorkspace,
      createNewWorkspace,
      renameWorkspace,
      getCardStats,
      exportToArena,
      isWorkspaceEmpty
    }}>
      {children}
    </DeckWorkspaceContext.Provider>
  )
}

export function useDeckWorkspace() {
  const context = useContext(DeckWorkspaceContext)
  if (context === undefined) {
    throw new Error('useDeckWorkspace must be used within a DeckWorkspaceProvider')
  }
  return context
}