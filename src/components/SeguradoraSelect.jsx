import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SeguradoraBadge from './SeguradoraBadge'
import { ChevronDown, Check, Search } from 'lucide-react'

// Cache módulo-level para não recarregar entre componentes
let _cache = null
let _promise = null

async function getSeguradoras() {
  if (_cache) return _cache
  if (!_promise) {
    // Busca todas as seguradoras — sem filtro de ativa para não omitir nenhuma
    _promise = supabase
      .from('seguradoras')
      .select('nome_canonico')
      .neq('ativa', false)
      .order('nome_canonico')
      .limit(500)
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
  const [open,        setOpen]        = useState(false)
  const [seguradoras, setSeguradoras] = useState(_cache || [])
  const [search,      setSearch]      = useState('')
  const wrapRef    = useRef(null)
  const searchRef  = useRef(null)

  useEffect(() => {
    getSeguradoras().then(setSeguradoras)
  }, [])

  // Foca o campo de busca ao abrir
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else setSearch('')
  }, [open])

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

  const filtered = search.trim()
    ? seguradoras.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : seguradoras

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
        <ChevronDown className={`w-4 h-4 ml-auto flex-shrink-0 text-dark-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 glass-panel overflow-hidden animate-fade-in">

          {/* Campo de busca incremental */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-border">
            <Search className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar seguradora..."
              className="flex-1 text-sm bg-transparent outline-none text-dark-text placeholder-dark-muted"
            />
          </div>

          {/* Opção vazia */}
          {!required && !search && (
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

          {/* Lista de seguradoras com scroll */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-dark-muted text-center py-4">
                {search ? 'Nenhuma encontrada' : 'Nenhuma seguradora cadastrada'}
              </p>
            ) : filtered.map(nome => (
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
