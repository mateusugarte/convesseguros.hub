import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import SeguradoraBadge from './SeguradoraBadge'
import { ChevronDown, Check, X } from 'lucide-react'

let _cache = null

async function getSeguradoras() {
  if (_cache) return _cache
  const { data } = await supabase
    .from('seguradoras')
    .select('nome_canonico')
    .neq('ativa', false)
    .order('nome_canonico')
    .limit(500)
  _cache = data?.map(s => s.nome_canonico) || []
  return _cache
}

export function invalidarCacheSeguradoras() { _cache = null }

export default function SeguradoraSelect({
  value,
  onChange,
  placeholder = 'Seguradora...',
  required    = false,
  className   = '',
  disabled    = false,
}) {
  const [seguradoras, setSeguradoras] = useState(_cache || [])
  const [open,        setOpen]        = useState(false)
  const [pos,         setPos]         = useState(null)
  const wrapRef     = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef    = useRef(null)

  useEffect(() => { getSeguradoras().then(setSeguradoras) }, [])

  function calcPos() {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    const dropH      = 300
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    const above      = spaceBelow < dropH && spaceAbove > spaceBelow
    setPos({
      left:  r.left,
      width: Math.max(r.width, 220),
      ...(above
        ? { bottom: window.innerHeight - r.top + 4, top: 'auto' }
        : { top:    r.bottom + 4,                   bottom: 'auto' }),
    })
  }

  useEffect(() => {
    if (!open) { setPos(null); return }
    calcPos()
    window.addEventListener('scroll', calcPos, true)
    window.addEventListener('resize', calcPos)
    return () => {
      window.removeEventListener('scroll', calcPos, true)
      window.removeEventListener('resize', calcPos)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (
        !wrapRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function select(nome) {
    onChange(nome)
    setOpen(false)
  }

  const filtered = value?.trim()
    ? seguradoras.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : seguradoras

  return (
    <div ref={wrapRef} className={`relative min-w-[180px] ${className}`}>

      {/* Combobox input */}
      <div className={`select flex items-center gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={e => { onChange(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.preventDefault() } }}
          placeholder={placeholder}
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
          <ChevronDown className={`w-4 h-4 text-dark-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </span>
      </div>

      {/* Portal — renderiza em document.body, escapa de qualquer stacking context */}
      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, zIndex: 9999, maxHeight: '300px', overflowY: 'auto', borderTop: '2px solid rgba(74,144,217,0.22)', boxShadow: '0 24px 64px rgba(0,0,0,0.32), 0 8px 24px rgba(20,60,140,0.16)' }}
          className="glass-panel animate-fade-in"
        >
          {!required && (
            <button
              type="button"
              onPointerDown={e => e.preventDefault()}
              onClick={() => select('')}
              className="w-full flex items-center px-3 py-2.5 text-left text-sm text-dark-muted hover:bg-dark-surface2 transition-colors border-b border-dark-border"
            >
              {placeholder}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="text-xs text-dark-muted text-center py-4 px-3">
              {value
                ? <span>Nenhuma mapeada — <span className="text-brand-accent font-medium">"{value}"</span> será salvo</span>
                : 'Nenhuma seguradora cadastrada'}
            </p>
          ) : (
            filtered.map(nome => (
              <button
                key={nome}
                type="button"
                onPointerDown={e => e.preventDefault()}
                onClick={() => select(nome)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-dark-surface2 transition-colors ${value === nome ? 'bg-brand-accent/10' : ''}`}
              >
                <SeguradoraBadge nome={nome} size="sm" />
                {value === nome && (
                  <Check className="ml-auto w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
