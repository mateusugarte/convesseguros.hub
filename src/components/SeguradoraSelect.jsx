import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SeguradoraBadge from './SeguradoraBadge'
import { ChevronDown, Check, X } from 'lucide-react'

// Cache módulo-level para não recarregar entre componentes
let _cache = null
let _promise = null

async function getSeguradoras() {
  if (_cache) return _cache
  if (!_promise) {
    _promise = supabase
      .from('seguradoras')
      .select('nome_canonico')
      .eq('ativa', true)
      .order('nome_canonico')
      .then(({ data }) => {
        _cache = data?.map(s => s.nome_canonico) || []
        return _cache
      })
  }
  return _promise
}

export function invalidarCacheSeguradoras() {
  _cache = null
  _promise = null
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function SeguradoraSelect({
  value,
  onChange,
  placeholder = 'Selecionar seguradora...',
  required = false,
  className = '',
  disabled = false,
}) {
  const [open,       setOpen]       = useState(false)
  const [seguradoras, setSeguradoras] = useState(_cache || [])
  const wrapRef = useRef(null)

  useEffect(() => {
    getSeguradoras().then(setSeguradoras)
  }, [])

  // Fecha ao clicar fora
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

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`select w-full flex items-center gap-2 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {value ? (
          <SeguradoraBadge nome={value} size="sm" />
        ) : (
          <span className="text-dark-muted text-sm">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 ml-auto flex-shrink-0 text-dark-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 glass-panel overflow-hidden animate-fade-in">
          {/* Opção vazia */}
          {!required && (
            <>
              <button
                type="button"
                onClick={() => selecionar('')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-dark-surface2 transition-colors ${!value ? 'text-brand-accent' : 'text-dark-muted'}`}
              >
                {!value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className={!value ? 'ml-0' : 'ml-5'}>Nenhuma</span>
              </button>
              <div className="border-t border-dark-border" />
            </>
          )}

          {/* Lista de seguradoras */}
          <div className="max-h-56 overflow-y-auto">
            {seguradoras.length === 0 ? (
              <p className="text-xs text-dark-muted text-center py-4">Nenhuma seguradora cadastrada</p>
            ) : seguradoras.map(nome => (
              <button
                key={nome}
                type="button"
                onClick={() => selecionar(nome)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-dark-surface2 transition-colors ${
                  value === nome ? 'bg-brand-accent/8' : ''
                }`}
              >
                <SeguradoraBadge nome={nome} size="sm" />
                {value === nome && (
                  <Check className="w-3.5 h-3.5 text-brand-accent ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
