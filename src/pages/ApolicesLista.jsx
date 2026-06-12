import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchApolicesLista, STATUS_EMISSAO_LABELS } from '../lib/apolices'
import { supabase } from '../lib/supabase'
import { useImobiliaria } from '../hooks/useImobiliaria'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, Download, Calendar, Filter } from 'lucide-react'
import { Select } from '../components/ui/Select'
import { DatePicker } from '../components/ui/DatePicker'

const FILTROS_PERIODO = [
  { key: 'hoje',        label: 'Hoje' },
  { key: 'semana',      label: 'Semana' },
  { key: 'mes',         label: 'Mês' },
  { key: 'personalizado', label: 'Personalizado' },
  { key: 'total',       label: 'Todo período' },
]

function getRangeFiltro(filtro, customFrom, customTo) {
  const now = new Date()
  if (filtro === 'hoje') {
    const s = new Date(now); s.setHours(0,0,0,0)
    return [s.toISOString(), now.toISOString()]
  }
  if (filtro === 'semana') {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0,0,0,0)
    return [s.toISOString(), now.toISOString()]
  }
  if (filtro === 'mes') {
    return [new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), now.toISOString()]
  }
  if (filtro === 'personalizado') {
    return [customFrom || null, customTo ? new Date(customTo + 'T23:59:59').toISOString() : null]
  }
  return [null, null]
}

function fmtBRL(v) {
  if (v === null || v === undefined || v === '') return '—'
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtData(v) {
  if (!v) return '—'
  try { return format(parseISO(String(v).slice(0,10) + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR }) } catch { return v }
}

function StatusBadge({ status }) {
  const s = STATUS_EMISSAO_LABELS[status] || { label: status, color: '#6B7280' }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: s.color + '20', color: s.color }}>
      {s.label}
    </span>
  )
}

function nomeFicha(item) {
  return item.fichas?.nome_empresa || item.fichas?.nome_interessado || item.nome_interessado || '—'
}

const PAGE_SIZE = 50

export default function ApolicesLista() {
  const navigate                          = useNavigate()
  const { resolverNome, getAliases } = useImobiliaria()

  const [apolices, setApolices] = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [page,     setPage]     = useState(0)
  const [segsOpcoes, setSegsOpcoes] = useState([])

  useEffect(() => {
    supabase.from('seguradoras').select('nome_canonico').eq('ativa', true).order('nome_canonico')
      .then(({ data }) => setSegsOpcoes(data?.map(s => s.nome_canonico) || []))
  }, [])

  // Campos do formulário (não disparam busca automaticamente)
  const [filtro,       setFiltro]       = useState('mes')
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')
  const [imobFiltro,   setImobFiltro]   = useState('')
  const [segFiltro,    setSegFiltro]    = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [busca,        setBusca]        = useState('')

  // Estado aplicado — atualizado apenas ao clicar "Buscar"
  const [applied, setApplied] = useState({
    filtro: 'mes', customFrom: '', customTo: '',
    imobFiltro: '', segFiltro: '', statusFiltro: '', busca: '',
  })

  function buscar() {
    setPage(0)
    setApplied({ filtro, customFrom, customTo, imobFiltro, segFiltro, statusFiltro, busca })
  }

  const getAliasesRef = useRef(getAliases)
  getAliasesRef.current = getAliases

  const load = useCallback(async () => {
    setLoading(true)
    const [dateFrom, dateTo] = getRangeFiltro(applied.filtro, applied.customFrom, applied.customTo)

    let imobiliariasFilter
    if (applied.imobFiltro) {
      imobiliariasFilter = await getAliasesRef.current(applied.imobFiltro)
      if (!imobiliariasFilter.length) imobiliariasFilter = [applied.imobFiltro]
    }

    const { data, count } = await fetchApolicesLista({
      dateFrom,
      dateTo,
      imobiliarias:  imobiliariasFilter,
      seguradora:    applied.segFiltro    || undefined,
      statusEmissao: applied.statusFiltro || undefined,
      busca:         applied.busca        || undefined,
      page,
      pageSize:      PAGE_SIZE,
    })
    setApolices(data)
    setTotal(count)
    setLoading(false)
  }, [applied, page])

  // Carrega na montagem e quando applied/page muda (não ao digitar filtros)
  useEffect(() => { load() }, [load])

  // Métricas do resultado atual
  const emitidas  = apolices.filter(a => a.status_emissao === 'emitida').length
  const enviadas  = apolices.filter(a => a.status_emissao === 'enviada').length
  const valorTotal = apolices.reduce((s, a) => s + (Number(a.valor_parcela) || 0), 0)

  // CSV export
  function exportarCSV() {
    const headers = ['Data Emissão','Imobiliária','Locatário','Apólice','Seguradora','Status','Parcela']
    const rows = apolices.map(a => [
      fmtData(a.data_emissao),
      resolverNome(a.imobiliaria),
      nomeFicha(a),
      a.numero_apolice || '',
      a.seguradora || '',
      STATUS_EMISSAO_LABELS[a.status_emissao]?.label || a.status_emissao || '',
      a.valor_parcela ? Number(a.valor_parcela).toFixed(2) : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'apolices.csv' })
    a.click()
  }

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="dashboard-hero flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-2">Gestão documental</div>
          <h1 className="title-display text-dark-text">Apólices</h1>
          <p className="section-lead mt-1">Listagem completa de todas as apólices</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="dashboard-hero-chip">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Total no filtro</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{total}</p>
          </div>
          <div className="dashboard-hero-chip">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Emitidas</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{emitidas}</p>
          </div>
          <div className="dashboard-hero-chip">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Valor total</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{fmtBRL(valorTotal)}</p>
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="card p-4 space-y-3">
        {/* Período */}
        <div className="flex flex-wrap items-center gap-1">
          {FILTROS_PERIODO.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filtro === f.key ? 'bg-brand-secondary text-white shadow-sm' : 'border border-dark-border text-dark-muted hover:text-dark-text hover:border-brand-accent/40'
                    }`}>
              {f.label}
            </button>
          ))}
        </div>

        {filtro === 'personalizado' && (
          <div className="flex items-center gap-2 text-xs text-dark-muted">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <DatePicker value={customFrom} onChange={v => setCustomFrom(v)} />
            <span>—</span>
            <DatePicker value={customTo} onChange={v => setCustomTo(v)} />
          </div>
        )}

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <ImobiliariaSelect
            value={imobFiltro}
            onChange={setImobFiltro}
            placeholder="Imobiliária"
            className="text-sm"
          />

          <Select
            value={segFiltro}
            onChange={setSegFiltro}
            placeholder="Seguradora"
            className="w-36"
            options={[{ value: '', label: 'Seguradora' }, ...segsOpcoes.map(s => ({ value: s, label: s }))]}
          />

          <Select
            value={statusFiltro}
            onChange={setStatusFiltro}
            placeholder="Status"
            className="w-36"
            options={[
              { value: '', label: 'Status' },
              ...Object.entries(STATUS_EMISSAO_LABELS).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
          />

          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar apólice, locatário..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
            />
          </div>

          <button
            onClick={buscar}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-secondary text-white text-xs font-semibold hover:bg-brand-primary transition-colors"
          >
            <Filter className="w-3.5 h-3.5" /> Buscar
          </button>

          <button onClick={exportarCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total no filtro',  val: total,                       color: '#4A90D9' },
          { label: 'Emitidas',         val: emitidas,                    color: '#8B5CF6' },
          { label: 'Enviadas',         val: enviadas,                    color: '#10B981' },
          { label: 'Valor total',      val: fmtBRL(valorTotal),          color: '#F59E0B' },
        ].map(({ label, val, color }) => (
          <div key={label} className="metric-tile">
            <p className="metric-label">{label}</p>
            <p className="metric-value" style={{ color }}>{val ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* ── Tabela ── */}
      <div className="table-shell overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Carregando...
          </div>
        ) : apolices.length === 0 ? (
          <div className="table-empty h-48">
            <p className="text-sm">Nenhuma apólice encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead border-b border-dark-border">
                <tr>
                  {['Data Emissão','Imobiliária','Locatário','Apólice','Seguradora','Status','Parcela','Emissor',''].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {apolices.map(a => (
                  <tr key={a.id} className="table-row" onClick={() => navigate(`/apolices/${a.id}`)}>
                    <td className="td text-dark-muted text-xs font-mono whitespace-nowrap">{fmtData(a.data_emissao)}</td>
                    <td className="td font-medium text-dark-text max-w-[140px] truncate">{resolverNome(a.imobiliaria) || '—'}</td>
                    <td className="td text-dark-text max-w-[150px] truncate">{nomeFicha(a)}</td>
                    <td className="td font-mono text-xs text-dark-muted">{a.numero_apolice || '—'}</td>
                    <td className="td text-dark-muted text-xs">{a.seguradora || '—'}</td>
                    <td className="td"><StatusBadge status={a.status_emissao} /></td>
                    <td className="td font-mono text-xs">{a.valor_parcela ? fmtBRL(a.valor_parcela) : '—'}</td>
                    <td className="td text-dark-muted text-xs">{a.profiles?.nome?.split(' ')[0] || '—'}</td>
                    <td className="td" onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate(`/apolices/${a.id}`)}
                              className="text-xs px-2 py-1 rounded border border-dark-border text-dark-muted hover:text-dark-text transition-colors">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border text-xs text-dark-muted">
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                      className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">← Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= pages - 1}
                      className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">Próximo →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

