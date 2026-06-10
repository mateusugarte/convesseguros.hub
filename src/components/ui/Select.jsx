import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Select customizado com dropdown position:fixed para escapar stacking contexts.
 *
 * Props:
 *   value        — valor selecionado
 *   onChange     — (value) => void
 *   options      — [{ value, label }] | string[] (strings usadas como value e label)
 *   placeholder  — texto quando nenhum valor selecionado
 *   disabled     — boolean
 *   className    — classes adicionais no wrapper
 *   name         — atributo name (para forms)
 */
export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Selecionar...',
  disabled = false,
  className = '',
  name,
}) {
  const [open,  setOpen]  = useState(false)
  const [style, setStyle] = useState(null)
  const wrapRef = useRef(null)

  // Normaliza options para [{value, label}]
  const normalized = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )

  const selected = normalized.find(o => o.value === value)

  // Calcula posição do dropdown (position:fixed com flip automático)
  useEffect(() => {
    if (!open) { setStyle(null); return }
    function calc() {
      if (!wrapRef.current) return
      const rect       = wrapRef.current.getBoundingClientRect()
      const dropH      = Math.min(normalized.length * 38 + 8, 260)
      const spaceBelow = window.innerHeight - rect.bottom
      const above      = spaceBelow < dropH && rect.top > spaceBelow
      setStyle({
        left:  rect.left,
        width: rect.width,
        ...(above
          ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
          : { top:    rect.bottom + 4, bottom: 'auto' }),
      })
    }
    calc()
    window.addEventListener('resize', calc, { passive: true })
    window.addEventListener('scroll', calc, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('scroll', calc, true)
    }
  }, [open, normalized.length])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function select(val) {
    onChange(val)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Hidden native input for form compatibility */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="select w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
      >
        <span className={`flex-1 truncate text-sm ${selected ? 'text-dark-text' : 'text-dark-muted'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 text-dark-muted transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Dropdown */}
      {open && style && (
        <div
          className="glass-panel animate-fade-in overflow-hidden"
          style={{ position: 'fixed', zIndex: 9999, ...style }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 256 }}>
            {normalized.length === 0 ? (
              <p className="text-xs text-dark-muted text-center py-4">Sem opções</p>
            ) : normalized.map(opt => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => select(opt.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-dark-surface2 ${
                    isSelected ? 'bg-brand-accent/10 text-brand-accent font-medium' : 'text-dark-text'
                  }`}
                >
                  {isSelected
                    ? <Check className="w-3.5 h-3.5 flex-shrink-0 text-brand-accent" />
                    : <span className="w-3.5 h-3.5 flex-shrink-0" />
                  }
                  <span className="flex-1 truncate">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
