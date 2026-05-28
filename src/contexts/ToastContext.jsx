import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const COLORS = {
  success: 'border-status-success/40 text-status-success',
  error:   'border-status-danger/40 text-status-danger',
  warning: 'border-status-warning/40 text-status-warning',
  info:    'border-brand-accent/40 text-brand-accent',
}

function Toast({ id, type = 'info', title, message, action, createdAt, onRemove }) {
  const Icon    = ICONS[type] ?? Info
  const color   = COLORS[type] ?? COLORS.info
  const elapsed = Math.round((Date.now() - createdAt) / 1000)
  const timeLabel = elapsed < 5 ? 'agora' : elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed/60)}m`

  return (
    <div className={`flex items-start gap-3 bg-dark-surface border ${color} rounded-xl px-4 py-3 shadow-2xl min-w-[300px] max-w-sm animate-slide-up pointer-events-auto`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color.split(' ')[1]}`} />
      <div className="flex-1 min-w-0">
        {title   && <p className="text-sm font-semibold text-dark-text">{title}</p>}
        {message && <p className="text-xs text-dark-muted mt-0.5">{message}</p>}
        {action && (
          <button
            onClick={() => { action.onClick(); onRemove() }}
            className="mt-1.5 text-xs font-medium text-brand-accent hover:text-brand-secondary transition-colors underline underline-offset-2"
          >
            {action.label}
          </button>
        )}
        <p className="text-[10px] text-dark-muted/50 mt-1">{timeLabel}</p>
      </div>
      <button onClick={onRemove} className="text-dark-muted hover:text-dark-text transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ type = 'info', title, message, action, duration = 8000 }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-2), { id, type, title, message, action, createdAt: Date.now() }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onRemove={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
