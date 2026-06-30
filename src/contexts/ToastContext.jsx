import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X, FileText, Car } from 'lucide-react'

const ToastCtx = createContext(null)

// Soft two-tone chime via Web Audio API — no external files needed
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const t = ctx.currentTime
    ;[880, 1109].forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = t + i * 0.18
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.10, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
      osc.start(start)
      osc.stop(start + 0.55)
    })
    setTimeout(() => ctx.close(), 1500)
  } catch (_) {}
}

const CONFIG = {
  success: {
    Icon:   CheckCircle,
    bar:    'bg-status-success',
    icon:   'text-status-success',
    border: 'border-status-success/35',
    ring:   'bg-status-success/12',
  },
  error: {
    Icon:   XCircle,
    bar:    'bg-status-danger',
    icon:   'text-status-danger',
    border: 'border-status-danger/35',
    ring:   'bg-status-danger/12',
  },
  warning: {
    Icon:   AlertTriangle,
    bar:    'bg-status-warning',
    icon:   'text-status-warning',
    border: 'border-status-warning/35',
    ring:   'bg-status-warning/12',
  },
  info: {
    Icon:   Info,
    bar:    'bg-brand-accent',
    icon:   'text-status-info',
    border: 'border-brand-accent/35',
    ring:   'bg-brand-accent/12',
  },
  // Special type for new fichas
  ficha: {
    Icon:   FileText,
    bar:    'bg-status-success',
    icon:   'text-status-success',
    border: 'border-status-success/40',
    ring:   'bg-status-success/12',
  },
  auto: {
    Icon:   Car,
    bar:    'bg-brand-accent',
    icon:   'text-status-info',
    border: 'border-brand-accent/35',
    ring:   'bg-brand-accent/12',
  },
}

function Toast({ type = 'info', title, message, action, duration, onRemove }) {
  const cfg = CONFIG[type] ?? CONFIG.info
  const { Icon } = cfg

  return (
    <div
      className={`relative flex items-start gap-3 rounded-xl px-4 py-4 w-[380px] max-w-[calc(100vw-2.5rem)] animate-slide-in-r pointer-events-auto overflow-hidden border ${cfg.border}`}
      style={{
        background: 'rgb(var(--color-surface))',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16)',
      }}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${cfg.bar}`} />

      {/* Icon */}
      <div className={`w-9 h-9 rounded-full ${cfg.ring} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-[18px] h-[18px] ${cfg.icon}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {type === 'ficha' && (
          <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-status-success bg-status-success/12 border border-status-success/25 rounded px-1.5 py-0.5 mb-1.5">
            Nova Ficha
          </span>
        )}
        {type === 'auto' && (
          <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-status-info bg-brand-accent/12 border border-brand-accent/25 rounded px-1.5 py-0.5 mb-1.5">
            Novo Seguro Auto
          </span>
        )}
        {title   && <p className="text-sm font-semibold text-dark-text leading-snug">{title}</p>}
        {message && <p className="text-xs text-dark-muted mt-0.5 leading-relaxed truncate">{message}</p>}
        {action  && (
          <button
            onClick={() => { action.onClick(); onRemove() }}
            className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${cfg.icon} hover:opacity-75 transition-opacity`}
          >
            {action.label}
            <span aria-hidden>→</span>
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-dark-muted/50 hover:text-dark-text transition-colors mt-0.5"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Auto-dismiss progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-[3px] ${cfg.bar} opacity-40 rounded-bl-xl`}
        style={{ animation: `toastProgress ${duration}ms linear forwards` }}
      />
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({
    type = 'info',
    title,
    message,
    action,
    duration = 6000,
    sound,
  }) => {
    const id = Date.now() + Math.random()
    // Play chime for ficha type or when explicitly requested
    if (type === 'ficha' || sound) playChime()
    setToasts(prev => [...prev.slice(-2), { id, type, title, message, action, duration }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onRemove={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
