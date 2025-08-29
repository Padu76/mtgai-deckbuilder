// src/components/Toast.tsx
'use client'
import { useState, useEffect, createContext, useContext, ReactNode } from 'react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString()
    const newToast = { ...toast, id, duration: toast.duration || 5000 }
    
    setToasts(prev => [...prev, newToast])
    
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onRemove(toast.id), 300) // Match animation duration
    }, (toast.duration || 5000) - 300)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  const icons = {
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    info: 'ℹ️'
  }

  const colorClasses = {
    success: 'bg-green-900 border-green-500 text-green-100',
    error: 'bg-red-900 border-red-500 text-red-100',
    warning: 'bg-yellow-900 border-yellow-500 text-yellow-100',
    info: 'bg-blue-900 border-blue-500 text-blue-100'
  }

  return (
    <div 
      className={`
        toast pointer-events-auto transform transition-all duration-300 ease-out
        ${isExiting 
          ? 'translate-x-full opacity-0 scale-95' 
          : 'translate-x-0 opacity-100 scale-100'
        }
        ${colorClasses[toast.type]}
        max-w-sm w-full shadow-lg rounded-lg border p-4
      `}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 text-lg mr-3">
          {icons[toast.type]}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-sm opacity-90 leading-relaxed">
              {toast.message}
            </div>
          )}
          {toast.action && (
            <div className="mt-3">
              <button
                onClick={() => {
                  toast.action?.onClick()
                  handleClose()
                }}
                className="text-xs font-medium underline opacity-80 hover:opacity-100 transition-opacity"
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleClose}
          className="flex-shrink-0 ml-2 text-white opacity-60 hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Helper hooks for common toast types
export function useSuccessToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => 
    addToast({ type: 'success', title, message })
}

export function useErrorToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => 
    addToast({ type: 'error', title, message })
}

export function useWarningToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => 
    addToast({ type: 'warning', title, message })
}

export function useInfoToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => 
    addToast({ type: 'info', title, message })
}

export default ToastProvider