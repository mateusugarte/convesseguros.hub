import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useComercial, leadMover, calcScore, scoreFaixa, PIPELINE_COLS, ORIGENS,
} from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import {
  Search, SlidersHorizontal, X, ChevronDown,
  ChevronRight, SearchX, Download, ArrowUpDown, ArrowUp, ArrowDown,
  Check, Building2, Calendar, Flame, Activity, AlertTriangle, Users,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DatePicker } from '../../components/ui/DatePicker'
import { CrmMetricCard, CrmPageHeader, CrmSectionCard } from '../../components/comercial'

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#2B5BA8','#EC4899','#06B6D4','#EF4444']
function avatarColor(name) { return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length] }
function initials(name) { return (name || '?').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() }

const ORIGEM_COLORS = {
  'Seguro Fiança':   '#3B82F6',
  'Indicação':       '#10B981',
  'Prospecção':      '#8B5CF6',
  'Outros Produtos': '#F59E0B',
}

function fmtDate(iso) {
  try { return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }) } catch { return '—' }
}

function useDebounce(value, ms) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return dv
}

const PAGE_SIZES = [20, 50, 100]

// ── Badges ────────────────────────────────────────────────────────────────────

function TemperaturaBadge({ score }) {
  const f = scoreFaixa(score)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ color: f.color, background: f.bg }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
      {f.label}
    </span>
  )
}

function EstagioBadge({ colId }) {
  const col = PIPELINE_COLS.find(c => c.id === colId)
  if (!col) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: col.color, background: col.color + '22' }}>
      {col.label}
    </span>
  )
}

function OrigemBadge({ origem }) {
  const color = ORIGEM_COLORS[origem] || '#6B7280'
  if (!origem) return <span className="text-dark-muted text-xs">—</span>
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color, background: color + '22' }}>
      {origem}
    </span>
  )
}

// ── FilterPanel ───────────────────────────────────────────────────────────────

function FilterPanel({ filters, onChange, onApply, onReset }) {
  const toggle = (key, val) => {
    const cur = filters[key] || []
    onChange(key, cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val])
  }
  const toggleTemp = (val) => {
    const cur = filters.temp || []
    onChange('temp', cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val])
  }

  return (
    <div className="glass-panel p-4 space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estágio */}
        <div>
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Estágio</p>
          <div className="flex flex-wrap gap-1.5">
            {PIPELINE_COLS.map(col => {
              const active = (filters.cols || []).includes(col.id)
              return (
                <button key={col.id} onClick={() => toggle('cols', col.id)}
                  className="px-2 py-1 rounded-lg text-[11px] font-medium border transition-all"
                  style={active
                    ? { borderColor: col.color, background: col.color + '22', color: col.color }
                    : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
                  {col.label}
                </button>
              )
            })}
          </div>
        </div>
        {/* Origem */}
        <div>
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Origem</p>
          <div className="flex flex-wrap gap-1.5">
            {ORIGENS.map(o => {
              const active = (filters.origens || []).includes(o)
              const color  = ORIGEM_COLORS[o] || '#6B7280'
              return (
                <button key={o} onClick={() => toggle('origens', o)}
                  className="px-2 py-1 rounded-lg text-[11px] font-medium border transition-all"
                  style={active
                    ? { borderColor: color, background: color + '22', color }
                    : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
                  {o}
                </button>
              )
            })}
          </div>
        </div>
        {/* Temperatura */}
        <div>
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Temperatura</p>
          <div className="flex gap-1.5">
            {[{ id: 'Quente', color: '#EF4444' }, { id: 'Morno', color: '#F59E0B' }, { id: 'Frio', color: '#4A90D9' }].map(({ id, color }) => {
              const active = (filters.temp || []).includes(id)
              return (
                <button key={id} onClick={() => toggleTemp(id)}
                  className="px-2 py-1 rounded-lg text-[11px] font-medium border transition-all"
                  style={active
                    ? { borderColor: color, background: color + '22', color }
                    : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
                  {id}
                </button>
              )
            })}
          </div>
        </div>
        {/* Período */}
        <div>
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Período</p>
          <div className="space-y-1.5">
            <DatePicker value={filters.from || ''} onChange={v => onChange('from', v)} />
            <DatePicker value={filters.to   || ''} onChange={v => onChange('to', v)} />
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onReset}  className="btn-secondary text-sm">Limpar</button>
        <button onClick={onApply}  className="btn-primary text-sm">Aplicar</button>
      </div>
    </div>
  )
}

// ── SortIcon ──────────────────────────────────────────────────────────────────

function SortIcon({ col, sort, dir }) {
  if (sort !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />
  return dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
}

// ── MoverDropdown ─────────────────────────────────────────────────────────────

function MoverDropdown({ onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} className="absolute bottom-full mb-1 left-0 w-44 glass-modal rounded-xl shadow-xl z-[300] py-1 overflow-hidden">
      {PIPELINE_COLS.map(col => (
        <button key={col.id} onClick={() => onSelect(col.id)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-text hover:bg-dark-surface2 text-left transition-colors">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
          {col.label}
        </button>
      ))}
    </div>
  )
}

// ── FloatingBar ───────────────────────────────────────────────────────────────

function FloatingBar({ count, leads, selectedIds, onDeselect, toast }) {
  const [moverOpen, setMoverOpen] = useState(false)

  async function handleMover(colId) {
    setMoverOpen(false)
    const ids = Array.from(selectedIds)
    await Promise.allSettled(ids.map(id => leadMover(id, colId)))
    toast({ type: 'success', title: `${ids.length} lead(s) movido(s)` })
    onDeselect()
  }

  function handleExportCSV() {
    const header = ['Nome','Imobiliária','Origem','Estágio','Criado em','Apólice']
    const rows = leads.filter(l => selectedIds.has(l.id)).map(l => {
      const col = PIPELINE_COLS.find(c => c.id === l.coluna)
      return [l.nome, l.imobiliaria || '', l.origem || '', col?.label || '', l.criadoEm ? fmtDate(l.criadoEm) : '', l.apoliceAtiva ? 'Sim' : 'Não']
        .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')
    })
    const csv  = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
    toast({ type: 'success', title: 'CSV exportado' })
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400]
      glass-modal rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-fade-in border border-dark-border">
      <span className="text-sm font-semibold text-dark-text whitespace-nowrap">{count} selecionado{count !== 1 ? 's' : ''}</span>
      <div className="w-px h-4 bg-dark-border" />
      <div className="relative">
        <button onClick={() => setMoverOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-surface2 text-sm text-dark-text hover:bg-dark-surface3 transition-colors">
          Mover <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {moverOpen && <MoverDropdown onSelect={handleMover} onClose={() => setMoverOpen(false)} />}
      </div>
      <button onClick={handleExportCSV}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-surface2 text-sm text-dark-text hover:bg-dark-surface3 transition-colors">
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
      <button onClick={onDeselect} className="text-dark-muted hover:text-dark-text transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BaseLeads() {
  const state    = useComercial()
  const navigate = useNavigate()
  const toast    = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL state
  const q          = searchParams.get('q')       || ''
  const sort       = searchParams.get('sort')    || 'temperatura'
  const dir        = searchParams.get('dir')     || 'desc'
  const page       = parseInt(searchParams.get('page') || '0', 10)
  const pageSize   = parseInt(searchParams.get('size') || '20', 10)
  const filterCols    = searchParams.get('cols')?.split(',').filter(Boolean)    || []
  const filterOrigens = searchParams.get('origens')?.split(',').filter(Boolean) || []
  const filterTemp    = searchParams.get('temp')?.split(',').filter(Boolean)    || []
  const filterFrom    = searchParams.get('from') || ''
  const filterTo      = searchParams.get('to')   || ''

  const [searchInput,    setSearchInput]    = useState(q)
  const [showFilter,     setShowFilter]     = useState(false)
  const [pendingFilters, setPendingFilters] = useState({ cols: filterCols, origens: filterOrigens, temp: filterTemp, from: filterFrom, to: filterTo })
  const [selectedIds,    setSelectedIds]    = useState(new Set())

  const debouncedQ = useDebounce(searchInput, 300)

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (debouncedQ) next.set('q', debouncedQ); else next.delete('q')
    next.set('page', '0')
    setSearchParams(next, { replace: true })
  }, [debouncedQ]) // eslint-disable-line

  function applyFilters() {
    const next = new URLSearchParams(searchParams)
    const f = pendingFilters
    if (f.cols.length)    next.set('cols',    f.cols.join(','));    else next.delete('cols')
    if (f.origens.length) next.set('origens', f.origens.join(',')); else next.delete('origens')
    if (f.temp.length)    next.set('temp',    f.temp.join(','));    else next.delete('temp')
    if (f.from) next.set('from', f.from); else next.delete('from')
    if (f.to)   next.set('to',   f.to);   else next.delete('to')
    next.set('page', '0')
    setSearchParams(next, { replace: true })
    setShowFilter(false)
  }

  function resetFilters() {
    setPendingFilters({ cols: [], origens: [], temp: [], from: '', to: '' })
  }

  function clearAllFilters() {
    const next = new URLSearchParams()
    if (q)                  next.set('q',    q)
    if (sort !== 'temperatura') next.set('sort', sort)
    if (dir !== 'desc')     next.set('dir',  dir)
    next.set('size', String(pageSize))
    setSearchParams(next, { replace: true })
    resetFilters()
    setShowFilter(false)
  }

  function toggleSort(col) {
    const next = new URLSearchParams(searchParams)
    if (sort === col) next.set('dir', dir === 'asc' ? 'desc' : 'asc')
    else { next.set('sort', col); next.set('dir', 'desc') }
    next.set('page', '0')
    setSearchParams(next, { replace: true })
  }

  function setPage(p) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    setSearchParams(next, { replace: true })
  }

  function setSize(s) {
    const next = new URLSearchParams(searchParams)
    next.set('size', String(s)); next.set('page', '0')
    setSearchParams(next, { replace: true })
  }

  // Filtering + sorting
  const filtered = useMemo(() => {
    let rows = [...(state.leads || [])]

    if (q) {
      const lq = q.toLowerCase()
      rows = rows.filter(l =>
        l.nome?.toLowerCase().includes(lq) ||
        (l.telefone || '').includes(lq) ||
        (l.imobiliaria || '').toLowerCase().includes(lq)
      )
    }
    if (filterCols.length)    rows = rows.filter(l => filterCols.includes(l.coluna))
    if (filterOrigens.length) rows = rows.filter(l => filterOrigens.includes(l.origem))
    if (filterTemp.length) {
      rows = rows.filter(l => {
        const s   = calcScore(l)
        const lbl = s > 60 ? 'Quente' : s > 30 ? 'Morno' : 'Frio'
        return filterTemp.includes(lbl)
      })
    }
    if (filterFrom) rows = rows.filter(l => l.criadoEm && l.criadoEm >= filterFrom)
    if (filterTo)   rows = rows.filter(l => l.criadoEm && l.criadoEm <= filterTo + 'T23:59:59')

    rows.sort((a, b) => {
      if (sort === 'nome') {
        const va = a.nome?.toLowerCase() || '', vb = b.nome?.toLowerCase() || ''
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      if (sort === 'criadoEm') {
        const va = a.criadoEm || '', vb = b.criadoEm || ''
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      const va = calcScore(a), vb = calcScore(b)
      return dir === 'asc' ? va - vb : vb - va
    })
    return rows
  }, [state.leads, q, filterCols, filterOrigens, filterTemp, filterFrom, filterTo, sort, dir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage   = Math.min(page, totalPages - 1)
  const pageRows   = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize)

  const allOnPageSelected = pageRows.length > 0 && pageRows.every(l => selectedIds.has(l.id))
  const someSelected      = pageRows.some(l => selectedIds.has(l.id))

  function toggleAll() {
    if (allOnPageSelected) setSelectedIds(prev => { const n = new Set(prev); pageRows.forEach(l => n.delete(l.id)); return n })
    else                   setSelectedIds(prev => { const n = new Set(prev); pageRows.forEach(l => n.add(l.id)); return n })
  }

  function toggleOne(id) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const activeChips = [
    ...filterCols.map(id => ({ key: 'cols', val: id, label: PIPELINE_COLS.find(c => c.id === id)?.label || id })),
    ...filterOrigens.map(o => ({ key: 'origens', val: o, label: o })),
    ...filterTemp.map(t => ({ key: 'temp', val: t, label: t })),
    ...(filterFrom ? [{ key: 'from', val: filterFrom, label: `De ${fmtDate(filterFrom)}` }] : []),
    ...(filterTo   ? [{ key: 'to',   val: filterTo,   label: `Até ${fmtDate(filterTo)}`  }] : []),
  ]

  function removeChip(chip) {
    const next = new URLSearchParams(searchParams)
    if (chip.key === 'from' || chip.key === 'to') {
      next.delete(chip.key)
    } else {
      const cur = (next.get(chip.key) || '').split(',').filter(Boolean).filter(v => v !== chip.val)
      if (cur.length) next.set(chip.key, cur.join(',')); else next.delete(chip.key)
    }
    next.set('page', '0')
    setSearchParams(next, { replace: true })
    setPendingFilters(p => chip.key === 'from' || chip.key === 'to' ? { ...p, [chip.key]: '' } : { ...p, [chip.key]: (p[chip.key] || []).filter(v => v !== chip.val) })
  }

  const hasFilters = activeChips.length > 0
  const hotLeads = filtered.filter(lead => calcScore(lead) > 60)
  const staleLeads = filtered.filter(lead => lead.ultimaAtividade && ((Date.now() - new Date(lead.ultimaAtividade).getTime()) / 86400000) >= 7)
  const proposalLeads = filtered.filter(lead => ['oferta', 'negociando', 'followup'].includes(lead.coluna) || lead.propostaEnviada)

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      <CrmPageHeader
        eyebrow="Base de leads"
        title="Segmentação, busca e qualificação"
        description="A base agora funciona como uma mesa de triagem comercial: filtros persistentes, leitura de temperatura e acesso rápido ao detalhe do lead."
        aside={(
          <div className="rounded-[24px] border border-dark-border/60 bg-white/70 px-4 py-3 text-sm shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-muted">Cobertura</p>
            <p className="mt-1 text-2xl font-black text-dark-text">{filtered.length}</p>
            <p className="mt-1 text-xs text-dark-muted">de {(state.leads || []).length} contatos visíveis</p>
          </div>
        )}
        actions={(
          <>
            <div className="relative min-w-[240px] max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-muted" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Buscar por nome, telefone ou imobiliária"
                className="input w-full py-2 pl-8 pr-8 text-sm"
              />
              {searchInput && (
                <button onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button onClick={() => setShowFilter(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors
                ${showFilter || hasFilters
                  ? 'border-brand-accent text-brand-accent bg-brand-accent/10'
                  : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-text/40'}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
              {hasFilters && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-brand-accent text-white text-[10px] flex items-center justify-center font-bold">
                  {activeChips.length}
                </span>
              )}
            </button>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CrmMetricCard icon={Users} label="Leads filtrados" value={filtered.length} accent="#2563EB" helper="Recorte atual da base" />
        <CrmMetricCard icon={Flame} label="Alta temperatura" value={hotLeads.length} accent="#DC2626" helper="Score acima de 60" />
        <CrmMetricCard icon={Activity} label="Em proposta" value={proposalLeads.length} accent="#7C3AED" helper="Oferta, negociação e follow-up" />
        <CrmMetricCard icon={AlertTriangle} label="Sem atividade" value={staleLeads.length} accent="#D97706" helper="7 dias ou mais sem contato" />
      </div>

      {(state.leads || []).length > 500 && (
        <div className="rounded-[22px] border border-status-warning/20 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          +500 leads carregados. Priorize filtros e busca para leitura mais precisa da operação.
        </div>
      )}

      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeChips.map((chip, i) => (
            <button key={i} onClick={() => removeChip(chip)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                bg-brand-accent/10 text-brand-accent border border-brand-accent/30 hover:bg-brand-accent/20 transition-colors">
              {chip.label} <X className="w-3 h-3" />
            </button>
          ))}
          <button onClick={clearAllFilters} className="text-xs text-dark-muted hover:text-dark-text transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Limpar tudo
          </button>
        </div>
      )}

      {showFilter && (
        <FilterPanel
          filters={pendingFilters}
          onChange={(k, v) => setPendingFilters(p => ({ ...p, [k]: v }))}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      )}

      <CrmSectionCard
        title="Tabela operacional"
        subtitle="Ordene, selecione e exporte leads com o mesmo contexto visual do restante do CRM."
        contentClassName="p-0"
      >
        <div className="table-shell overflow-hidden rounded-none border-0 bg-transparent shadow-none">
        <div className="overflow-x-auto">
          <table className="table-table text-sm">
            <thead className="table-thead">
              <tr className="border-b border-dark-border">
                <th className="w-10 px-3 py-3">
                  <button onClick={toggleAll}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                      ${allOnPageSelected ? 'bg-brand-accent border-brand-accent'
                        : someSelected    ? 'bg-brand-accent/40 border-brand-accent'
                        : 'border-dark-border hover:border-brand-accent/60'}`}>
                    {(allOnPageSelected || someSelected) && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                </th>
                <th className="text-left px-3 py-3">
                  <button onClick={() => toggleSort('nome')} className="flex items-center gap-1 text-xs font-semibold text-dark-muted uppercase tracking-wider hover:text-dark-text transition-colors">
                    Lead <SortIcon col="nome" sort={sort} dir={dir} />
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-dark-muted uppercase tracking-wider whitespace-nowrap">Imobiliária</th>
                <th className="text-left px-3 py-3">
                  <button onClick={() => toggleSort('temperatura')} className="flex items-center gap-1 text-xs font-semibold text-dark-muted uppercase tracking-wider hover:text-dark-text transition-colors">
                    Temp. <SortIcon col="temperatura" sort={sort} dir={dir} />
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-dark-muted uppercase tracking-wider">Origem</th>
                <th className="text-left px-3 py-3">
                  <button onClick={() => toggleSort('criadoEm')} className="flex items-center gap-1 text-xs font-semibold text-dark-muted uppercase tracking-wider hover:text-dark-text transition-colors whitespace-nowrap">
                    Criado <SortIcon col="criadoEm" sort={sort} dir={dir} />
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-dark-muted uppercase tracking-wider">Estágio</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-dark-muted uppercase tracking-wider">Apólice</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="table-empty">
                      <SearchX className="table-empty-icon text-dark-muted" />
                      <p className="text-dark-muted text-sm">Nenhum lead encontrado</p>
                      {hasFilters && (
                        <button onClick={clearAllFilters} className="btn-secondary text-xs">Limpar filtros</button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : pageRows.map(lead => {
                const score    = calcScore(lead)
                const selected = selectedIds.has(lead.id)
                const aColor   = avatarColor(lead.nome)
                return (
                  <tr key={lead.id}
                    className={`border-b border-dark-border/50 transition-colors cursor-pointer
                      ${selected ? 'bg-brand-accent/5' : 'hover:bg-dark-surface2'}`}>
                    <td className="px-3 py-3.5" onClick={e => { e.stopPropagation(); toggleOne(lead.id) }}>
                      <button
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                          ${selected ? 'bg-brand-accent border-brand-accent' : 'border-dark-border hover:border-brand-accent/60'}`}>
                        {selected && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                    </td>
                    <td className="px-3 py-3.5" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                          style={{ background: aColor }}>
                          {initials(lead.nome)}
                        </div>
                        <div>
                          <p className="font-semibold text-dark-text leading-tight">{lead.nome}</p>
                          {lead.telefone && <p className="text-[11px] text-dark-muted font-mono">{lead.telefone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      {lead.imobiliaria
                        ? <div className="flex items-center gap-1 text-xs text-dark-muted"><Building2 className="w-3 h-3 flex-shrink-0" />{lead.imobiliaria}</div>
                        : <span className="text-dark-muted text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3.5" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      <TemperaturaBadge score={score} />
                    </td>
                    <td className="px-3 py-3.5" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      <OrigemBadge origem={lead.origem} />
                    </td>
                    <td className="px-3 py-3.5 text-xs text-dark-muted whitespace-nowrap" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      {lead.criadoEm
                        ? <div className="flex items-center gap-1"><Calendar className="w-3 h-3 flex-shrink-0" />{fmtDate(lead.criadoEm)}</div>
                        : '—'}
                    </td>
                    <td className="px-3 py-3.5" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      <EstagioBadge colId={lead.coluna} />
                    </td>
                    <td className="px-3 py-3.5" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      {lead.apoliceAtiva
                        ? <span className="inline-flex items-center rounded-full border border-emerald-700/15 bg-emerald-700/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Ativa</span>
                        : <span className="text-dark-muted text-xs">—</span>}
                    </td>
                    <td className="px-2 py-3.5" onClick={() => navigate(`/comercial/leads/${lead.id}`)}>
                      <ChevronRight className="w-4 h-4 text-dark-muted opacity-40" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Paginação ──────────────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs text-dark-muted">
              <span>Por página:</span>
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => setSize(s)}
                  className={`px-2 py-0.5 rounded-lg transition-colors font-medium
                    ${pageSize === s ? 'bg-brand-accent/15 text-brand-accent' : 'hover:bg-dark-surface2 text-dark-muted'}`}>
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-dark-muted">
              {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} de {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dark-border text-dark-muted disabled:opacity-40 hover:text-dark-text hover:border-dark-text/40 transition-colors disabled:cursor-not-allowed">
                Anterior
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p
                if (totalPages <= 7)          p = i
                else if (safePage < 4)        p = i
                else if (safePage > totalPages - 5) p = totalPages - 7 + i
                else                          p = safePage - 3 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                      ${p === safePage ? 'bg-brand-accent text-white' : 'text-dark-muted hover:bg-dark-surface2'}`}>
                    {p + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dark-border text-dark-muted disabled:opacity-40 hover:text-dark-text hover:border-dark-text/40 transition-colors disabled:cursor-not-allowed">
                Próxima
              </button>
            </div>
          </div>
        )}
        </div>
      </CrmSectionCard>

      {/* ── Floating bar ───────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <FloatingBar
          count={selectedIds.size}
          leads={filtered}
          selectedIds={selectedIds}
          onDeselect={() => setSelectedIds(new Set())}
          toast={toast}
        />
      )}
    </div>
  )
}
