import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function CommandPalette({ open, onClose, onOpenFicha }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery(''); setResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      const s = query.trim()
      const { data } = await supabase
        .from('fichas')
        .select('id, nome_interessado, cpf, imobiliaria, produto, status, created_at')
        .or(`nome_interessado.ilike.%${s}%,cpf.ilike.%${s}%,imobiliaria.ilike.%${s}%`)
        .order('created_at', { ascending: false })
        .limit(8)
      setResults(data || [])
      setLoading(false)
    }, 280)
    return () => clearTimeout(t)
  }, [query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-start justify-center pt-24 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
          <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nome, CPF ou imobiliária..."
            className="flex-1 bg-transparent text-dark-text placeholder-dark-muted outline-none text-sm"
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          {loading && (
            <svg className="w-4 h-4 animate-spin text-dark-muted" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="py-1 max-h-96 overflow-y-auto">
            {results.map(f => {
              const si = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
              return (
                <button
                  key={f.id}
                  onClick={() => onOpenFicha(f.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-dark-surface2 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-text truncate">{f.nome_interessado || 'Sem nome'}</p>
                    <p className="text-xs text-dark-muted mt-0.5 truncate">
                      {f.imobiliaria && `${f.imobiliaria} · `}{f.cpf}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`badge ${si.color} text-[10px]`}>{si.label}</span>
                    <span className="text-[10px] text-dark-muted">
                      {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div className="py-10 text-center text-dark-muted text-sm">
            Nenhuma ficha encontrada
          </div>
        )}

        {!query && (
          <div className="py-6 text-center text-dark-muted text-xs space-y-1">
            <p>Busca rápida de fichas</p>
            <p className="text-dark-muted/50">Nome, CPF ou imobiliária</p>
          </div>
        )}
      </div>
    </div>
  )
}
