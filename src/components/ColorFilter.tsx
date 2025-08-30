// src/components/ColorFilter.tsx
// Componente condiviso per filtri colore in tutto il sistema

'use client'
import { useState } from 'react'

interface ColorFilterProps {
  selectedColors: string[]
  onColorToggle: (color: string) => void
  onClearColors: () => void
  title?: string
  compact?: boolean
  showCount?: boolean
  totalItems?: number
  className?: string
}

interface Color {
  code: string
  name: string
  style: string
}

const COLORS: Color[] = [
  { code: 'W', name: 'Bianco', style: 'bg-white text-gray-800 border-2 border-gray-300' },
  { code: 'U', name: 'Blu', style: 'bg-blue-500 text-white' },
  { code: 'B', name: 'Nero', style: 'bg-gray-900 text-white border-2 border-gray-600' },
  { code: 'R', name: 'Rosso', style: 'bg-red-500 text-white' },
  { code: 'G', name: 'Verde', style: 'bg-green-500 text-white' },
  { code: 'C', name: 'Incolore', style: 'bg-gray-400 text-white border-2 border-gray-500' }
]

// Componente per singolo simbolo mana
function ManaSymbol({ 
  color, 
  size = 'medium', 
  isSelected = false,
  onClick 
}: { 
  color: Color
  size?: 'small' | 'medium' | 'large'
  isSelected?: boolean
  onClick?: () => void
}) {
  const sizeClasses = {
    small: 'w-4 h-4 text-xs',
    medium: 'w-6 h-6 text-sm', 
    large: 'w-8 h-8 text-base'
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        relative transition-all duration-200 
        ${sizeClasses[size]} 
        ${color.style}
        rounded-full 
        flex items-center justify-center 
        font-bold shadow-sm
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected 
          ? 'transform scale-110 ring-2 ring-white ring-opacity-50' 
          : onClick 
            ? 'opacity-70 hover:opacity-100 hover:transform hover:scale-105' 
            : 'opacity-100'
        }
        ${!onClick ? '' : 'hover:shadow-md'}
      `}
      title={`${isSelected ? 'Rimuovi' : 'Aggiungi'} ${color.name}`}
      type="button"
    >
      {color.code}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
      )}
    </button>
  )
}

// Hook per logica di matching colori
export function useColorMatching() {
  const matchesColorFilter = (itemColors: string[], selectedColors: string[]) => {
    if (selectedColors.length === 0) return true
    
    const comboColors = itemColors || []
    const hasColorlessSelected = selectedColors.includes('C')
    const coloredColorsSelected = selectedColors.filter(c => c !== 'C')
    
    // Se è selezionato solo incolore
    if (hasColorlessSelected && coloredColorsSelected.length === 0) {
      return comboColors.length === 0
    }
    
    // Se sono selezionati colori normali + incolore
    if (hasColorlessSelected && coloredColorsSelected.length > 0) {
      // Mostra items che hanno TUTTI i colori selezionati (escluso C) OPPURE items incolori
      return comboColors.length === 0 || coloredColorsSelected.every(selectedColor => 
        comboColors.includes(selectedColor)
      )
    }
    
    // Se sono selezionati solo colori normali (no incolore)
    // L'item deve contenere TUTTI i colori selezionati (ma può averne altri)
    return coloredColorsSelected.every(selectedColor => 
      comboColors.includes(selectedColor)
    )
  }

  return { matchesColorFilter }
}

// Componente principale ColorFilter
export default function ColorFilter({
  selectedColors,
  onColorToggle,
  onClearColors,
  title = "Filtra per Colori",
  compact = false,
  showCount = true,
  totalItems,
  className = ""
}: ColorFilterProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)

  const getDescriptionText = () => {
    if (selectedColors.length === 0) {
      return 'Seleziona colori per filtrare'
    }
    
    const hasColorless = selectedColors.includes('C')
    const coloredColors = selectedColors.filter(c => c !== 'C')
    
    if (hasColorless && coloredColors.length === 0) {
      return 'Solo combo/carte incolori'
    }
    
    if (hasColorless && coloredColors.length > 0) {
      return `Combo/carte ${coloredColors.join('')} o incolori`
    }
    
    return `Combo/carte con ${selectedColors.join('')} (${selectedColors.length} color${selectedColors.length === 1 ? 'e' : 'i'})`
  }

  if (compact && !isExpanded) {
    return (
      <div className={`bg-gray-800 rounded-lg p-3 ${className}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-between w-full text-sm text-gray-300 hover:text-white transition-colors"
        >
          <span>Filtri Colore</span>
          <div className="flex items-center gap-2">
            {selectedColors.length > 0 && (
              <div className="flex gap-1">
                {selectedColors.slice(0, 3).map(colorCode => {
                  const color = COLORS.find(c => c.code === colorCode)!
                  return (
                    <ManaSymbol 
                      key={colorCode} 
                      color={color} 
                      size="small"
                      isSelected={true}
                    />
                  )
                })}
                {selectedColors.length > 3 && (
                  <span className="text-xs text-gray-400">+{selectedColors.length - 3}</span>
                )}
              </div>
            )}
            <span className="text-lg">▼</span>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        <div className="flex items-center gap-2">
          {selectedColors.length > 0 && (
            <button 
              onClick={onClearColors}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Pulisci
            </button>
          )}
          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              ▲
            </button>
          )}
        </div>
      </div>
      
      <div className="flex gap-2 justify-center mb-3">
        {COLORS.map(color => (
          <ManaSymbol
            key={color.code}
            color={color}
            size="medium"
            isSelected={selectedColors.includes(color.code)}
            onClick={() => onColorToggle(color.code)}
          />
        ))}
      </div>
      
      <div className="text-center">
        {showCount && totalItems !== undefined && (
          <p className="text-xs text-gray-500 mb-1">
            Filtri attivi su {totalItems} elementi
          </p>
        )}
        <p className="text-xs text-gray-400">
          {getDescriptionText()}
        </p>
      </div>
    </div>
  )
}

// Componente semplificato per visualizzazione simboli mana (senza filtro)
export function ManaSymbols({ 
  colors, 
  size = 'medium' 
}: { 
  colors: string[]
  size?: 'small' | 'medium' | 'large' 
}) {
  if (!colors || colors.length === 0) {
    const colorlessColor = COLORS.find(c => c.code === 'C')!
    return (
      <ManaSymbol 
        color={colorlessColor} 
        size={size}
      />
    )
  }

  return (
    <div className="flex items-center gap-1">
      {colors.map((colorCode, index) => {
        const color = COLORS.find(c => c.code === colorCode) || COLORS.find(c => c.code === 'C')!
        return (
          <ManaSymbol 
            key={`${colorCode}-${index}`} 
            color={color} 
            size={size}
          />
        )
      })}
    </div>
  )
}

// Utility per ottenere descrizione colori per testi
export function getColorDescription(colors: string[]): string {
  if (!colors || colors.length === 0) return 'Incolore'
  
  const colorNames = colors.map(c => {
    const color = COLORS.find(col => col.code === c)
    return color?.name || 'Sconosciuto'
  }).join(', ')
  
  return colorNames
}