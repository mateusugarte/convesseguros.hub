import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { STATUS_EMISSAO_LABELS } from '../lib/apolices'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function makeResultKey(type, id) {
  return `${type}:${id}`
}

export default function CommandPalette({ open, onClose, onOpenFicha, onOpenApolice }) {
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
      const term = normalizeSearchText(s)
      const [fichasRes, apolicesRes] = await Promise.all([
        supabase
          .from('fichas')
          .select('id, nome_interessado, nome_empresa, cnpj, cpf, imobiliaria, produto, status, created_at, numero_apolice, raw_data')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('apolices')
          .select('id, ficha_id, numero_apolice, nome_interessado, imobiliaria, status_emissao, created_at, fichas!ficha_id(nome_interessado, nome_empresa, cpf, cnpj, produto)')
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const matchesFicha = (row) => {
        const raw = row?.raw_data || {}
        const haystack = [
          row.nome_interessado,
          row.nome_empresa,
          row.cpf,
          row.cnpj,
          row.imobiliaria,
          row.numero_apolice,
          raw.nome_interessado,
          raw.nome_empresa,
        ].map(normalizeSearchText).join(' ')
        return haystack.includes(term)
      }

      const matchesApolice = (row) => {
        const ficha = row?.fichas || {}
        const haystack = [
          row.numero_apolice,
          row.nome_interessado,
          row.imobiliaria,
          ficha.nome_interessado,
          ficha.nome_empresa,
          ficha.cpf,
          ficha.cnpj,
          ficha.imobiliaria,
        ].map(normalizeSearchText).join(' ')
        return haystack.includes(term)
      }

      const fichas = (fichasRes.data || [])
        .filter(matchesFicha)
        .map(item => ({
          type: 'ficha',
          id: item.id,
          title: item.produto === 'pessoa_juridica'
            ? (item.nome_empresa || item.nome_interessado || 'Sem nome')
            : (item.nome_interessado || 'Sem nome'),
          subtitle: `${item.imobiliaria || 'Sem imobiliária'} · ${item.cpf || item.cnpj || 'Sem doc'}`,
          status: item.status,
          statusLabel: STATUS_LABELS[item.status]?.label || item.status,
          statusTone: STATUS_LABELS[item.status]?.color || '',
          createdAt: item.created_at,
        }))

      const apolices = (apolicesRes.data || [])
        .filter(matchesApolice)
        .map(item => ({
          type: 'apolice',
          id: item.id,
          fichaId: item.ficha_id || null,
          title: item.fichas?.produto === 'pessoa_juridica'
            ? (item.fichas?.nome_empresa || item.nome_interessado || 'Sem nome')
            : (item.fichas?.nome_interessado || item.nome_interessado || 'Sem nome'),
          subtitle: `${item.imobiliaria || 'Sem imobiliária'} · ${item.numero_apolice || 'Sem apólice'}`,
          status: item.status_emissao,
          statusLabel: STATUS_EMISSAO_LABELS[item.status_emissao]?.label || item.status_emissao,
          statusTone: STATUS_EMISSAO_LABELS[item.status_emissao]?.color || '#6B7280',
          createdAt: item.created_at,
        }))

      const merged = []
      const seen = new Map()
      for (const item of [...fichas, ...apolices]) {
        const key = item.type === 'apolice'
          ? makeResultKey('ficha', item.fichaId || item.id)
          : makeResultKey('ficha', item.id)
        if (item.type === 'apolice' || !seen.has(key)) {
          seen.set(key, item)
        }
      }
      for (const item of seen.values()) {
        merged.push(item)
      }

      setResults(merged.slice(0, 8))
      setLoading(false)
    }, 280)
    return () => clearTimeout(t)
  }, [query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[45] flex items-start justify-center pt-24 px-4 animate-fade-in"
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="glass-modal w-full max-w-xl overflow-hidden relative z-10"
        style={{ boxShadow: '0 0 0 1px rgba(74,144,217,0.18), 0 24px 64px rgba(0,0,0,0.38), 0 8px 24px rgba(20,60,140,0.20)' }}
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
              return (
                <button
                  key={`${f.type}:${f.id}`}
                  onClick={() => {
                    if (f.type === 'apolice') onOpenApolice?.(f.id)
                    else onOpenFicha?.(f.id)
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-dark-surface2 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-text truncate">
                      {f.title}
                    </p>
                    <p className="text-xs text-dark-muted mt-0.5 truncate">
                      {f.subtitle}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="badge text-[10px]" style={{ background: `${f.statusTone}20`, color: f.statusTone }}>
                      {f.statusLabel}
                    </span>
                    <span className="text-[10px] text-dark-muted">
                      {format(parseISO(f.createdAt), 'dd/MM/yy', { locale: ptBR })}
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
            <p>Busca rápida de fichas e apólices</p>
            <p className="text-dark-muted/50">Nome, CPF, CNPJ, apólice ou imobiliária</p>
          </div>
        )}
      </div>
    </div>
  )
}
