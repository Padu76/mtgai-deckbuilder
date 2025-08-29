// src/hooks/useArenaExport.ts
import { useState } from 'react'
import { DeckCard, ArenaExportOptions, exportDeckToArena } from '../lib/arena-export'

export function useArenaExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [lastExport, setLastExport] = useState<string | null>(null)

  const exportToClipboard = async (
    deck: DeckCard[],
    sideboard: DeckCard[] = [],
    options: ArenaExportOptions = {}
  ) => {
    setIsExporting(true)
    try {
      const exportText = exportDeckToArena(deck, sideboard, options)
      await navigator.clipboard.writeText(exportText)
      setLastExport(exportText)
      return { success: true, text: exportText }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return { success: false, error }
    } finally {
      setIsExporting(false)
    }
  }

  const exportToFile = (
    deck: DeckCard[],
    filename: string = 'deck',
    sideboard: DeckCard[] = [],
    options: ArenaExportOptions = {}
  ) => {
    setIsExporting(true)
    try {
      const exportText = exportDeckToArena(deck, sideboard, options)
      const blob = new Blob([exportText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
      setLastExport(exportText)
      return { success: true, text: exportText }
    } catch (error) {
      console.error('Failed to export file:', error)
      return { success: false, error }
    } finally {
      setIsExporting(false)
    }
  }

  const getExportPreview = (
    deck: DeckCard[],
    sideboard: DeckCard[] = [],
    options: ArenaExportOptions = {}
  ) => {
    return exportDeckToArena(deck, sideboard, options)
  }

  return {
    exportToClipboard,
    exportToFile,
    getExportPreview,
    isExporting,
    lastExport
  }
}