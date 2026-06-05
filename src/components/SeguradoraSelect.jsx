import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import SeguradoraBadge from './SeguradoraBadge'
import { ChevronDown } from 'lucide-react'

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
  placeholder = 'Selecionar seguradora...',
  required = false,
  className = '',
  disabled = false,
}) {
  const [seguradoras, setSeguradoras] = useState(_cache || [])
  const [open, setOpen]               = useState(false)
  const [pos, setPos]                 = useState(null)
  const triggerRef                    = useRef(null)
  const dropdownRef                   = useRef(null)

  useEffect(() => { getSeguradoras().then(setSeguradoras) }, [])

  function calcPos() {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  function toggle() {
    if (disabled) return
    if (!open) calcPos()
    setOpen(o => !o)
  }

  // Fechar ao clicar fora de trigger + dropdown
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reposicionar ao scrollar/redimensionar
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', calcPos, true)
    window.addEventListener('resize', calcPos)
    return () => {
      window.removeEventListener('scroll', calcPos, true)
      window.removeEventListener('resize', calcPos)
    }
  }, [open])

  function select(nome) {
    onChange(nome)
    setOpen(false)
  }

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        className={`select w-full flex items-center gap-2 text-left min-h-[38px] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {value ? (
          <SeguradoraBadge nome={value} size="sm" />
        ) : (
          <span className="text-dark-muted text-sm">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 ml-auto flex-shrink-0 text-dark-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Portal — renderiza em document.body, escapa de qualquer stacking context */}
      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, maxHeight: '300px', overflowY: 'auto' }}
          className="glass-panel animate-fade-in shadow-lg"
        >
          <div>
            {!required && (
              <button
                type="button"
                onClick={() => select('')}
                className="w-full flex items-center px-3 py-2 text-left text-sm text-dark-muted hover:bg-dark-surface2 transition-colors"
              >
                {placeholder}
              </button>
            )}
            {seguradoras.length === 0 ? (
              <p className="text-xs text-dark-muted text-center py-4">Nenhuma seguradora cadastrada</p>
            ) : (
              seguradoras.map(nome => (
                <button
                  key={nome}
                  type="button"
                  onClick={() => select(nome)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-surface2 transition-colors ${value === nome ? 'bg-brand-accent/10' : ''}`}
                >
                  <SeguradoraBadge nome={nome} size="sm" />
                  {value === nome && (
                    <span className="ml-auto text-brand-accent text-xs font-bold">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
