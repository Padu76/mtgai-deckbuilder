// src/components/CardPreview.tsx
'use client'
import { useState } from 'react'

interface Card {
  id: string
  name: string
  mana_cost?: string
  mana_value?: number
  colors?: string[]
  types?: string[]
  oracle_text?: string
  image_uris?: {
    small?: string
    normal?: string
    large?: string
    art_crop?: string
  } | null
  image_url?: string | null
  rarity?: string
  set_code?: string
}

interface CardPreviewProps {
  card: Card
  showQuantity?: boolean
  quantity?: number
  onQuantityChange?: (newQuantity: number) => void
  size?: 'small' | 'normal' | 'large'
  className?: string
  onClick?: () => void
  maxQuantity?: number
}

export default function CardPreview({ 
  card, 
  showQuantity = false, 
  quantity = 1, 
  onQuantityChange,
  size = 'normal',
  className = '',
  onClick,
  maxQuantity = 4
}: CardPreviewProps) {
  const [imageError, setImageError] = useState(false)
  
  const sizeClasses = {
    small: 'w-16 h-22',
    normal: 'w-24 h-32', 
    large: 'w-32 h-44'
  }
  
  // Priorità per le immagini: image_uris.small > image_uris.normal > image_url > fallback Gatherer
  const imageUrl = card.image_uris?.small || 
                   card.image_uris?.normal || 
                   card.image_url ||
                   `https://gatherer.wizards.com/Handlers/Image.ashx?type=card&name=${encodeURIComponent(card.name)}`
  
  const rarityColors = {
    common: 'border-gray-400',
    uncommon: 'border-blue-400', 
    rare: 'border-yellow-400',
    mythic: 'border-orange-500'
  }
  
  const rarityColor = rarityColors[card.rarity as keyof typeof rarityColors] || 'border-gray-600'
  
  // Converte simboli di mana in emoji/simboli
  const formatManaSymbols = (mana?: string) => {
    if (!mana) return ''
    
    return mana
      .replace(/\{W\}/g, '⚪')
      .replace(/\{U\}/g, '🔵')
      .replace(/\{B\}/g, '⚫')
      .replace(/\{R\}/g, '🔴')
      .replace(/\{G\}/g, '🟢')
      .replace(/\{C\}/g, '◇')
      .replace(/\{([0-9]+)\}/g, '$1')
      .replace(/\{([^}]+)\}/g, '$1')
  }

  const handleClick = () => {
    if (onClick) {
      onClick()
    }
  }

  const handleQuantityChange = (newQuantity: number, e: React.MouseEvent) => {
    e.stopPropagation() // Previeni il click sulla carta
    if (onQuantityChange) {
      onQuantityChange(Math.max(0, Math.min(maxQuantity, newQuantity)))
    }
  }

  return (
    <div 
      className={`relative bg-gray-900 rounded-lg border-2 ${rarityColor} overflow-hidden transition-all hover:shadow-lg ${
        onClick ? 'cursor-pointer hover:scale-105' : ''
      } ${className}`}
      onClick={handleClick}
    >
      {/* Immagine carta */}
      <div className={`relative ${sizeClasses[size]}`}>
        {!imageError ? (
          <img 
            src={imageUrl}
            alt={card.name}
            className="w-full h-full object-cover rounded-t-lg"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col justify-center items-center p-2 text-center">
            <div className="text-xs font-bold text-white mb-1 leading-tight">
              {card.name}
            </div>
            <div className="text-xs text-gray-300 mb-1">
              {formatManaSymbols(card.mana_cost)}
            </div>
            <div className="text-xs text-gray-500">
              {card.types?.[0] || 'Card'}
            </div>
          </div>
        )}
        
        {/* Quantity counter */}
        {showQuantity && quantity > 0 && (
          <div className="absolute top-1 right-1 bg-orange-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg">
            {quantity}
          </div>
        )}
      </div>
      
      {/* Info rapide */}
      {size !== 'small' && (
        <div className="p-2 bg-gray-800">
          <div className="text-xs font-medium text-white truncate mb-1" title={card.name}>
            {card.name}
          </div>
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs text-gray-300">
              {formatManaSymbols(card.mana_cost)}
            </div>
            <div className="text-xs text-gray-500">
              {card.set_code?.toUpperCase()}
            </div>
          </div>
          
          {/* Tipo carta */}
          <div className="text-xs text-gray-400 truncate mb-2">
            {card.types?.join(' ') || ''}
          </div>
          
          {/* Quantity controls */}
          {showQuantity && onQuantityChange && (
            <div className="flex items-center justify-center space-x-2">
              <button 
                onClick={(e) => handleQuantityChange(quantity - 1, e)}
                className="w-6 h-6 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                disabled={quantity <= 0}
              >
                −
              </button>
              <span className="text-xs text-white font-medium w-8 text-center">
                {quantity}
              </span>
              <button 
                onClick={(e) => handleQuantityChange(quantity + 1, e)}
                className="w-6 h-6 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                disabled={quantity >= maxQuantity}
              >
                +
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Hover tooltip per oracle text */}
      {card.oracle_text && size !== 'small' && (
        <div className="absolute inset-x-0 bottom-0 bg-black bg-opacity-95 text-white text-xs p-2 opacity-0 hover:opacity-100 transition-opacity duration-200 max-h-32 overflow-y-auto pointer-events-none">
          <div className="font-medium mb-1">{card.name}</div>
          <div className="leading-relaxed">{card.oracle_text}</div>
        </div>
      )}
    </div>
  )
}