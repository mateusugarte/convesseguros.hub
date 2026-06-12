import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

function FieldShell({ label, error, description, children, labelClassName = '' }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className={`block text-[11px] font-semibold text-dark-muted uppercase tracking-[0.14em] ${labelClassName}`}>
          {label}
        </label>
      )}
      {children}
      {description && !error && <p className="text-[11px] text-dark-muted">{description}</p>}
      {error && <p className="text-[11px] text-status-danger">{error}</p>}
    </div>
  )
}

export function Input({ label, error, description, className = '', labelClassName = '', ...props }) {
  return (
    <FieldShell label={label} error={error} description={description} labelClassName={labelClassName}>
      <input {...props} className={`input ${error ? 'border-status-danger focus:ring-status-danger/20' : ''} ${className}`} />
    </FieldShell>
  )
}

export function Textarea({ label, error, description, className = '', labelClassName = '', ...props }) {
  return (
    <FieldShell label={label} error={error} description={description} labelClassName={labelClassName}>
      <textarea {...props} className={`input resize-none ${error ? 'border-status-danger' : ''} ${className}`} />
    </FieldShell>
  )
}

export function Select({
  label,
  error,
  description,
  options = [],
  value,
  onChange,
  placeholder = 'Selecionar...',
  className = '',
  labelClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }

    function calc() {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const above = spaceBelow < 200 && rect.top > spaceBelow
      setPos({
        left: rect.left,
        width: rect.width,
        ...(above ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' } : { top: rect.bottom + 4, bottom: 'auto' }),
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
    function handler(e) {
      if (!triggerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => (typeof o === 'object' ? o.value : o) === value)
  const selectedLabel = selected ? (typeof selected === 'object' ? selected.label : selected) : null

  return (
    <FieldShell label={label} error={error} description={description} labelClassName={labelClassName}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`select w-full flex items-center justify-between text-left ${error ? 'border-status-danger' : ''} ${className}`}
      >
        <span className={selectedLabel ? 'text-dark-text' : 'text-dark-muted/60'}>{selectedLabel ?? placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-dark-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          className="glass-panel animate-fade-in py-1"
          style={{ position: 'fixed', zIndex: 300, ...pos, maxHeight: 240, overflowY: 'auto' }}
        >
          {options.map(opt => {
            const optionValue = typeof opt === 'object' ? opt.value : opt
            const optionLabel = typeof opt === 'object' ? opt.label : opt
            return (
              <button
                key={optionValue}
                type="button"
                onClick={() => {
                  onChange(optionValue)
                  setOpen(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-dark-text hover:bg-dark-surface2 transition-colors text-left"
              >
                {optionLabel}
                {optionValue === value && <Check className="w-3.5 h-3.5 text-brand-accent" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </FieldShell>
  )
}
