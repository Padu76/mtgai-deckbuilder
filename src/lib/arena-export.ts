// src/lib/arena-export.ts

export interface DeckCard {
  name: string
  quantity: number
  category?: 'creature' | 'spell' | 'land' | 'artifact' | 'enchantment' | 'planeswalker'
  mana_value?: number
  types?: string[]
  colors?: string[]
}

export interface ArenaExportOptions {
  sortCards?: boolean
  validateDeck?: boolean
  includeSideboard?: boolean
  format?: 'standard' | 'historic' | 'brawl'
}

export function exportDeckToArena(
  deck: DeckCard[], 
  sideboard: DeckCard[] = [],
  options: ArenaExportOptions = {}
): string {
  const {
    sortCards = true,
    validateDeck = true,
    includeSideboard = false,
    format = 'standard'
  } = options

  // Validate deck if requested
  if (validateDeck) {
    const validation = validateDeckInternal(deck, format)
    if (!validation.isValid) {
      console.warn('Deck validation warnings:', validation.warnings)
    }
  }

  // Sort cards by category and mana value
  const sortedDeck = sortCards ? sortDeckForArena(deck) : deck

  // Format main deck
  const mainDeckText = sortedDeck
    .filter(card => card.quantity > 0)
    .map(card => `${card.quantity} ${card.name}`)
    .join('\n')

  // Format sideboard if included
  let sideboardText = ''
  if (includeSideboard && sideboard.length > 0) {
    const sortedSideboard = sortCards ? sortDeckForArena(sideboard) : sideboard
    sideboardText = '\n\nSideboard:\n' + sortedSideboard
      .filter(card => card.quantity > 0)
      .map(card => `${card.quantity} ${card.name}`)
      .join('\n')
  }

  return mainDeckText + sideboardText
}

export function sortDeckForArena(deck: DeckCard[]): DeckCard[] {
  return [...deck].sort((a, b) => {
    // First sort by category priority
    const categoryOrder = ['land', 'creature', 'artifact', 'enchantment', 'planeswalker', 'spell']
    const aCategoryIndex = categoryOrder.indexOf(a.category || 'spell')
    const bCategoryIndex = categoryOrder.indexOf(b.category || 'spell')

    if (aCategoryIndex !== bCategoryIndex) {
      return aCategoryIndex - bCategoryIndex
    }

    // Then by mana value
    const aManaValue = a.mana_value || 0
    const bManaValue = b.mana_value || 0
    if (aManaValue !== bManaValue) {
      return aManaValue - bManaValue
    }

    // Finally by name alphabetically
    return a.name.localeCompare(b.name)
  })
}

export function validateDeckInternal(deck: DeckCard[], format: string = 'standard') {
  const warnings: string[] = []
  const totalCards = deck.reduce((sum, card) => sum + card.quantity, 0)

  // Check deck size
  const expectedSize = format === 'brawl' ? 100 : 60
  if (totalCards !== expectedSize) {
    warnings.push(`Deck has ${totalCards} cards, expected ${expectedSize} for ${format}`)
  }

  // Check individual card limits
  deck.forEach(card => {
    const maxCopies = format === 'brawl' ? 1 : 4
    if (card.quantity > maxCopies) {
      warnings.push(`${card.name} has ${card.quantity} copies, max ${maxCopies} for ${format}`)
    }
  })

  // Check for basic lands (can have more than 4)
  const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']
  deck.forEach(card => {
    if (!basicLands.includes(card.name) && card.quantity > 4 && format !== 'brawl') {
      warnings.push(`${card.name} exceeds 4 copies and is not a basic land`)
    }
  })

  return {
    isValid: warnings.length === 0,
    warnings,
    totalCards,
    expectedSize
  }
}

export function generateDeckStats(deck: DeckCard[]) {
  const stats = {
    totalCards: 0,
    manaCurve: {} as { [key: number]: number },
    colorDistribution: {} as { [key: string]: number },
    typeDistribution: {} as { [key: string]: number }
  }

  deck.forEach(card => {
    stats.totalCards += card.quantity

    // Mana curve
    const manaValue = card.mana_value || 0
    stats.manaCurve[manaValue] = (stats.manaCurve[manaValue] || 0) + card.quantity

    // Color distribution
    if (card.colors) {
      card.colors.forEach(color => {
        stats.colorDistribution[color] = (stats.colorDistribution[color] || 0) + card.quantity
      })
    }

    // Type distribution
    if (card.types) {
      card.types.forEach(type => {
        stats.typeDistribution[type] = (stats.typeDistribution[type] || 0) + card.quantity
      })
    }
  })

  return stats
}