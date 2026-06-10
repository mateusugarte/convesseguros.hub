import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-dark-muted uppercase tracking-wider">{label}</label>}
      <input {...props} className={`input ${error ? 'border-status-danger focus:ring-status-danger/20' : ''} ${className}`} />
      {error && <p className="text-[11px] text-status-danger">{error}</p>}
    </div>
  )
}

// ── Textarea ──────────────────────────────────────────────────────────────────
export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-dark-muted uppercase tracking-wider">{label}</label>}
      <textarea {...props} className={`input resize-none ${error ? 'border-status-danger' : ''} ${className}`} />
      {error && <p className="text-[11px] text-status-danger">{error}</p>}
    </div>
  )
}

// ── Select (portal-based, never clipped) ─────────────────────────────────────
export function Select({ label, error, options = [], value, onChange, placeholder = 'Selecionar...', className = '' }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) { setPos(null); return }
    function calc() {
      if (!triggerRef.current) return
      const r = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      const above = spaceBelow < 200 && r.top > spaceBelow
      setPos({
        left:  r.left,
        width: r.width,
        ...(above ? { bottom: window.innerHeight - r.top + 4, top: 'auto' } : { top: r.bottom + 4, bottom: 'auto' }),
      })
    }
    calc()
    window.addEventListener('resize', calc, { passive: true })
    window.addEventListener('scroll', calc, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('scroll', calc, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) { if (!triggerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => (typeof o === 'object' ? o.value : o) === value)
  const selectedLabel = selected ? (typeof selected === 'object' ? selected.label : selected) : null

  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-dark-muted uppercase tracking-wider">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`select w-full flex items-center justify-between text-left ${error ? 'border-status-danger' : ''} ${className}`}
      >
        <span className={selectedLabel ? 'text-dark-text' : 'text-dark-muted/60'}>{selectedLabel ?? placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-dark-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {error && <p className="text-[11px] text-status-danger">{error}</p>}

      {open && pos && createPortal(
        <div
          className="glass-panel animate-fade-in py-1"
          style={{ position: 'fixed', zIndex: 300, ...pos, maxHeight: 240, overflowY: 'auto' }}
        >
          {options.map(opt => {
            const v = typeof opt === 'object' ? opt.value : opt
            const l = typeof opt === 'object' ? opt.label : opt
            return (
              <button
                key={v}
                type="button"
                onClick={() => { onChange(v); setOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-dark-text hover:bg-dark-surface2 transition-colors text-left"
              >
                {l}
                {v === value && <Check className="w-3.5 h-3.5 text-brand-accent" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
