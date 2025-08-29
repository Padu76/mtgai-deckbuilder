// src/components/ManaSymbols.tsx
// Componente per visualizzare simboli mana colorati

import React from 'react'

interface ManaSymbolProps {
  color: string
  size?: 'small' | 'medium' | 'large'
  className?: string
}

interface ManaSymbolsProps {
  colors: string[]
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export function ManaSymbol({ color, size = 'medium', className = '' }: ManaSymbolProps) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5', 
    large: 'w-6 h-6'
  }

  const colorClasses = {
    'W': 'bg-white border-2 border-gray-300',
    'U': 'bg-blue-500',
    'B': 'bg-gray-900 border-2 border-gray-600',
    'R': 'bg-red-500',
    'G': 'bg-green-500',
    'C': 'bg-gray-400 border-2 border-gray-500'
  }

  const textColor = {
    'W': 'text-gray-800',
    'U': 'text-white',
    'B': 'text-white', 
    'R': 'text-white',
    'G': 'text-white',
    'C': 'text-white'
  }

  const normalizedColor = color.toUpperCase()
  const bgClass = colorClasses[normalizedColor as keyof typeof colorClasses] || colorClasses['C']
  const textClass = textColor[normalizedColor as keyof typeof textColor] || textColor['C']

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        ${bgClass} 
        ${textClass}
        ${className}
        rounded-full 
        flex 
        items-center 
        justify-center 
        font-bold 
        text-xs
        shadow-sm
      `}
      title={`${getManaColorName(normalizedColor)} mana`}
    >
      {normalizedColor}
    </div>
  )
}

export function ManaSymbols({ colors, size = 'medium', className = '' }: ManaSymbolsProps) {
  if (!colors || colors.length === 0) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-gray-500 text-sm">Colorless</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {colors.map((color, index) => (
        <ManaSymbol 
          key={`${color}-${index}`} 
          color={color} 
          size={size}
        />
      ))}
    </div>
  )
}

export function ManaSymbolsFromCost({ manaCost, size = 'medium', className = '' }: { 
  manaCost: string | null | undefined
  size?: 'small' | 'medium' | 'large'
  className?: string 
}) {
  if (!manaCost) {
    return <span className={`text-gray-500 text-sm ${className}`}>—</span>
  }

  // Parse mana cost string like "{2}{U}{B}" or "{R}{R}{G}"
  const manaSymbols = parseManaString(manaCost)

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {manaSymbols.map((symbol, index) => {
        // Handle colorless numbers
        if (/^\d+$/.test(symbol)) {
          const sizeClasses = {
            small: 'w-4 h-4 text-xs',
            medium: 'w-5 h-5 text-xs', 
            large: 'w-6 h-6 text-sm'
          }
          
          return (
            <div 
              key={`${symbol}-${index}`}
              className={`
                ${sizeClasses[size]}
                bg-gray-400 
                text-white 
                rounded-full 
                flex 
                items-center 
                justify-center 
                font-bold
                border-2 
                border-gray-500
              `}
              title={`${symbol} colorless mana`}
            >
              {symbol}
            </div>
          )
        }
        
        // Handle colored mana symbols
        return (
          <ManaSymbol 
            key={`${symbol}-${index}`} 
            color={symbol} 
            size={size}
          />
        )
      })}
    </div>
  )
}

function parseManaString(manaCost: string): string[] {
  // Remove curly braces and split by }{
  const cleaned = manaCost.replace(/[{}]/g, ' ').trim()
  const symbols = cleaned.split(/\s+/).filter(s => s.length > 0)
  
  return symbols
}

function getManaColorName(color: string): string {
  const names = {
    'W': 'Bianco',
    'U': 'Blu', 
    'B': 'Nero',
    'R': 'Rosso',
    'G': 'Verde',
    'C': 'Incolore'
  }
  
  return names[color as keyof typeof names] || 'Sconosciuto'
}

// Utility function to get mana colors from a mana cost string
export function getColorsFromManaCost(manaCost: string | null | undefined): string[] {
  if (!manaCost) return []
  
  const symbols = parseManaString(manaCost)
  const colors = symbols.filter(symbol => /^[WUBRG]$/.test(symbol))
  
  // Return unique colors only
  return [...new Set(colors)]
}

export default ManaSymbols