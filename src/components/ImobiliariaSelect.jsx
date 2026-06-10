import { useState, useEffect, useRef } from 'react'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { Building2, ChevronDown, Check, Search, X } from 'lucide-react'

// Gera hue determinístico a partir do nome (para colorir o dot de cada imobiliária)
function nameToHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % 360
}

export default function ImobiliariaSelect({
  value,
  onChange,
  placeholder  = 'Selecionar imobiliária...',
  required     = false,
  className    = '',
  disabled     = false,
  showAll      = true,
  allLabel     = 'Todas as imobiliárias',
}) {
  const { grupos, loading } = useImobiliaria()
  const [open,          setOpen]          = useState(false)
  const [search,        setSearch]        = useState('')
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const wrapRef   = useRef(null)
  const searchRef = useRef(null)

  // position:fixed — escapa stacking contexts de backdrop-filter, com flip automático
  useEffect(() => {
    if (!open) { setDropdownStyle(null); return }
    function calcPos() {
      if (!wrapRef.current) return
      const rect       = wrapRef.current.getBoundingClientRect()
      const dropH      = 280 // altura máxima do dropdown
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const above      = spaceBelow < dropH && spaceAbove > spaceBelow
      setDropdownStyle({
        left:   rect.left,
        width:  rect.width,
        ...(above
          ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
          : { top:    rect.bottom + 4,                   bottom: 'auto' }
        ),
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
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else setSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function selecionar(nome) {
    onChange(nome)
    setOpen(false)
  }

  const filtered = search.trim()
    ? grupos.filter(g => g.nome_canonico.toLowerCase().includes(search.toLowerCase()))
    : grupos

  const dotColor = value ? `hsl(${nameToHue(value)}, 55%, 52%)` : null

  return (
    <div ref={wrapRef} className={`relative ${className}`}>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        className={`select w-full flex items-center gap-2 text-left min-w-0 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {value ? (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: dotColor }}
            />
            <span className="text-sm text-dark-text truncate">{value}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
            <span className="text-sm text-dark-muted truncate">{loading ? 'Carregando...' : placeholder}</span>
          </span>
        )}

        {value && !required && (
          <span
            role="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="flex-shrink-0 text-dark-muted hover:text-dark-text transition-colors p-0.5 rounded"
          >
            <X className="w-3 h-3" />
          </span>
        )}

        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-dark-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown — position:fixed para escapar de stacking contexts */}
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
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-border">
            <Search className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar imobiliária..."
              className="flex-1 text-sm bg-transparent outline-none text-dark-text placeholder-dark-muted"
            />
          </div>

          {/* Opção "Todas" */}
          {showAll && !search && (
            <>
              <button
                type="button"
                onClick={() => selecionar('')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-dark-surface2 transition-colors ${
                  !value ? 'text-brand-accent' : 'text-dark-muted'
                }`}
              >
                {!value ? (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span>{allLabel}</span>
              </button>
              <div className="border-t border-dark-border" />
            </>
          )}

          {/* Lista */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-dark-muted text-center py-4">
                {search ? 'Nenhuma encontrada' : 'Nenhuma imobiliária cadastrada'}
              </p>
            ) : filtered.map(g => {
              const hue   = nameToHue(g.nome_canonico)
              const color = `hsl(${hue}, 55%, 52%)`
              const bg    = `hsl(${hue}, 55%, 52%, 0.12)`
              const isSelected = value === g.nome_canonico
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selecionar(g.nome_canonico)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-dark-surface2 transition-colors ${
                    isSelected ? 'bg-brand-accent/8' : ''
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: color, boxShadow: isSelected ? `0 0 0 2px ${bg}` : 'none' }}
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
