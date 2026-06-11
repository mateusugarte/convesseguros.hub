import { useState, useEffect, useRef } from 'react'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { Building2, ChevronDown, Check, X } from 'lucide-react'

function nameToHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % 360
}

export default function ImobiliariaSelect({
  value,
  onChange,
  placeholder  = 'Imobiliária...',
  required     = false,
  className    = '',
  disabled     = false,
  showAll      = true,
  allLabel     = 'Todas as imobiliárias',
}) {
  const { grupos, loading } = useImobiliaria()
  const [open,          setOpen]          = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) { setDropdownStyle(null); return }
    function calcPos() {
      if (!wrapRef.current) return
      const rect       = wrapRef.current.getBoundingClientRect()
      const dropH      = 280
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const above      = spaceBelow < dropH && spaceAbove > spaceBelow
      setDropdownStyle({
        left:  rect.left,
        width: Math.max(rect.width, 220),
        ...(above
          ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
          : { top:    rect.bottom + 4,                   bottom: 'auto' }),
      })
    }
    calcPos()
    window.addEventListener('resize', calcPos, { passive: true })
    window.addEventListener('scroll', calcPos, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', calcPos)
      window.removeEventListener('scroll', calcPos, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleChange(e) {
    onChange(e.target.value)
    if (!open) setOpen(true)
  }

  function selecionar(nome) {
    onChange(nome)
    setOpen(false)
  }

  const filtered = value?.trim()
    ? grupos.filter(g => g.nome_canonico.toLowerCase().includes(value.toLowerCase()))
    : grupos

  const isMapped = value && grupos.some(g => g.nome_canonico === value)
  const dotColor = isMapped ? `hsl(${nameToHue(value)}, 55%, 52%)` : null

  return (
    <div ref={wrapRef} className={`relative min-w-[180px] ${className}`}>

      {/* Combobox input */}
      <div className={`select flex items-center gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {dotColor ? (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
        ) : (
          <Building2 className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.preventDefault() } }}
          placeholder={loading ? 'Carregando...' : placeholder}
          disabled={disabled}
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-dark-text placeholder-dark-muted"
        />
        {value && !required && (
          <button
            type="button"
            onPointerDown={e => e.preventDefault()}
            onClick={() => { onChange(''); inputRef.current?.focus() }}
            className="flex-shrink-0 text-dark-muted hover:text-dark-text transition-colors p-0.5 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <span
          role="button"
          tabIndex={-1}
          onPointerDown={e => { e.preventDefault(); setOpen(o => !o); if (!open) inputRef.current?.focus() }}
          className="flex-shrink-0 cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 text-dark-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </div>

      {/* Dropdown — position:fixed para escapar stacking contexts */}
      {open && dropdownStyle && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            position: 'fixed',
            top:      dropdownStyle.top,
            bottom:   dropdownStyle.bottom,
            left:     dropdownStyle.left,
            width:    dropdownStyle.width,
            zIndex:   9999,
          }}
        >
          {/* Opção "Todas" só aparece quando input está vazio */}
          {showAll && !value && (
            <>
              <button
                type="button"
                onPointerDown={e => e.preventDefault()}
                onClick={() => selecionar('')}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-brand-accent hover:bg-dark-surface2 transition-colors"
              >
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{allLabel}</span>
              </button>
              <div className="border-t border-dark-border" />
            </>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-dark-muted text-center py-4 px-3">
                {value
                  ? <span>Nenhuma mapeada — <span className="text-brand-accent font-medium">"{value}"</span> será salvo</span>
                  : 'Nenhuma imobiliária cadastrada'}
              </p>
            ) : filtered.map(g => {
              const hue        = nameToHue(g.nome_canonico)
              const color      = `hsl(${hue}, 55%, 52%)`
              const isSelected = value === g.nome_canonico
              return (
                <button
                  key={g.id}
                  type="button"
                  onPointerDown={e => e.preventDefault()}
                  onClick={() => selecionar(g.nome_canonico)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-dark-surface2 transition-colors ${
                    isSelected ? 'bg-brand-accent/8' : ''
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-sm text-dark-text flex-1 truncate">{g.nome_canonico}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
