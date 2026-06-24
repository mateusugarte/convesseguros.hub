import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchApolicesLista, STATUS_EMISSAO_LABELS } from '../lib/apolices'
import { supabase } from '../lib/supabase'
import { useImobiliaria } from '../hooks/useImobiliaria'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, Download, Filter, ListChecks, LayoutGrid } from 'lucide-react'
import { Select } from '../components/ui/Select'
import { DatePicker } from '../components/ui/DatePicker'
import { PageHeader, MetricCard, DataCard } from '../components/ui'

const FILTROS_PERIODO = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'personalizado', label: 'Personalizado' },
  { key: 'total', label: 'Todo período' },
]

function getRangeFiltro(filtro, customFrom, customTo) {
  const now = new Date()
  if (filtro === 'hoje') {
    const s = new Date(now); s.setHours(0, 0, 0, 0)
    return [s.toISOString(), now.toISOString()]
  }
  if (filtro === 'semana') {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0)
    return [s.toISOString(), now.toISOString()]
  }
  if (filtro === 'mes') return [new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), now.toISOString()]
  if (filtro === 'personalizado') return [customFrom || null, customTo ? new Date(`${customTo}T23:59:59`).toISOString() : null]
  return [null, null]
}

function fmtBRL(v) {
  if (v === null || v === undefined || v === '') return '—'
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtData(v) {
  if (!v) return '—'
  try { return format(parseISO(String(v).slice(0, 10) + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR }) } catch { return v }
}

function StatusBadge({ status }) {
  const s = STATUS_EMISSAO_LABELS[status] || { label: status, color: '#6B7280' }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${s.color}20`, color: s.color }}>
      {s.label}
    </span>
  )
}

function nomeFicha(item) {
  return item.fichas?.nome_empresa || item.fichas?.nome_interessado || item.nome_interessado || '—'
}

function isApoliceSemFicha(item) {
  return !item?.ficha_id && Boolean(item?.raw_data?.origem_upload_direto)
}

const PAGE_SIZE = 50

export default function ApolicesLista() {
  const navigate = useNavigate()
  const { resolverNome, getAliases } = useImobiliaria()

  const [apolices, setApolices] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  const [filtro, setFiltro] = useState('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [imobFiltro, setImobFiltro] = useState('')
  const [segFiltro, setSegFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [segsOpcoes, setSegsOpcoes] = useState([])

  const [applied, setApplied] = useState({
    filtro: 'mes', customFrom: '', customTo: '',
    imobFiltro: '', segFiltro: '', statusFiltro: '', busca: '',
  })

  useEffect(() => {
    supabase
      .from('seguradoras')
      .select('nome_canonico')
      .eq('ativa', true)
      .order('nome_canonico')
      .then(({ data }) => setSegsOpcoes(data?.map(s => s.nome_canonico) || []))
  }, [])

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
      imobiliarias: imobiliariasFilter,
      seguradora: applied.segFiltro || undefined,
      statusEmissao: applied.statusFiltro || undefined,
      busca: applied.busca || undefined,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })

    setApolices(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [applied, page])

  useEffect(() => { load() }, [load])

  async function exportarCSV() {
    const [dateFrom, dateTo] = getRangeFiltro(applied.filtro, applied.customFrom, applied.customTo)
    let imobiliariasFilter
    if (applied.imobFiltro) {
      imobiliariasFilter = await getAliasesRef.current(applied.imobFiltro)
      if (!imobiliariasFilter.length) imobiliariasFilter = [applied.imobFiltro]
    }
    const { data } = await fetchApolicesLista({
      dateFrom,
      dateTo,
      imobiliarias: imobiliariasFilter,
      seguradora: applied.segFiltro || undefined,
      statusEmissao: applied.statusFiltro || undefined,
      busca: applied.busca || undefined,
      offset: 0,
      limit: 1000,
    })

    const rows = (data || []).map(a => [
      fmtData(a.data_emissao),
      resolverNome(a.imobiliaria) || a.imobiliaria || '',
      nomeFicha(a),
      a.numero_apolice || '',
      a.seguradora || '',
      STATUS_EMISSAO_LABELS[a.status_emissao]?.label || a.status_emissao || '',
      a.valor_parcela ? fmtBRL(a.valor_parcela) : '',
      a.profiles?.nome || '',
    ])

    const csv = [
      ['Data Emissão', 'Imobiliária', 'Locatário', 'Apólice', 'Seguradora', 'Status', 'Parcela', 'Emissor'],
      ...rows,
    ].map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `apolices-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const emitidas = apolices.filter(a => a.status_emissao === 'emitida').length
  const enviadas = apolices.filter(a => a.status_emissao === 'enviada').length
  const valorTotal = apolices.reduce((sum, a) => sum + (Number(a.valor_parcela) || 0), 0)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Apólices"
        title="Lista de Apólices"
        description="Visão tabular do fluxo de apólices com filtros por período, imobiliária, seguradora e status. A navegação para o detalhe segue no mesmo fluxo premium."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/apolices')} className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text">
              <LayoutGrid className="h-3.5 w-3.5" /> Dashboard
            </button>
            <button onClick={() => navigate('/apolices/gestao')} className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text">
              <ListChecks className="h-3.5 w-3.5" /> Gestão
            </button>
          </div>
        )}
        stats={(
          <>
            <MetricCard label="Total no filtro" value={total} hint="resultado aplicado" tone="accent" />
            <MetricCard label="Emitidas" value={emitidas} hint="status emitida" tone="secondary" />
            <MetricCard label="Enviadas" value={enviadas} hint="status enviada" tone="success" />
            <MetricCard label="Valor total" value={fmtBRL(valorTotal)} hint="soma das parcelas" tone="warning" />
          </>
        )}
      />

      <DataCard title="Filtros" subtitle="Combine período e atributos da apólice antes de buscar." bodyClassName="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS_PERIODO.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFiltro(opt.key)}
              className={`rounded-2xl px-3 py-2 text-xs font-medium transition-colors ${filtro === opt.key ? 'bg-brand-secondary text-white' : 'border border-dark-border text-dark-muted hover:text-dark-text'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Imobiliária</label>
            <ImobiliariaSelect value={imobFiltro} onChange={setImobFiltro} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Seguradora</label>
            <Select value={segFiltro} onChange={setSegFiltro} options={['', ...segsOpcoes].map(v => ({ value: v, label: v || 'Todas' }))} placeholder="Todas" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Status</label>
            <Select value={statusFiltro} onChange={setStatusFiltro} options={[{ value: '', label: 'Todos' }, ...Object.entries(STATUS_EMISSAO_LABELS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Busca</label>
            <div className="flex items-center gap-2 rounded-2xl border border-dark-border px-3 py-2 bg-dark-surface2/60">
              <Search className="h-4 w-4 text-dark-muted" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                className="w-full bg-transparent text-sm text-dark-text outline-none placeholder:text-dark-muted"
                placeholder="Nome, apólice, CPF/CNPJ..."
              />
            </div>
          </div>
        </div>

        {filtro === 'personalizado' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">De</label>
              <DatePicker value={customFrom} onChange={setCustomFrom} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Até</label>
              <DatePicker value={customTo} onChange={setCustomTo} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={buscar} className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-secondary px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90">
            <Filter className="h-3.5 w-3.5" /> Buscar
          </button>
          <button onClick={exportarCSV} className="inline-flex items-center gap-1.5 rounded-2xl border border-dark-border px-4 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
        </div>
      </DataCard>

      <DataCard title="Tabela de apólices" subtitle={`Resultados aplicados: ${total}. Clique em uma linha para abrir o detalhe.`}>
        {loading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-dark-muted">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Carregando...
          </div>
        ) : apolices.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-dark-border text-sm text-dark-muted">
            Nenhuma apólice encontrada
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead border-b border-dark-border">
                <tr>
                  {['Data Emissão', 'Imobiliária', 'Locatário', 'Apólice', 'Seguradora', 'Status', 'Parcela', 'Emissor', ''].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {apolices.map(a => (
                  <tr key={a.id} className="table-row" onClick={() => navigate(`/apolices/${a.id}`)}>
                    <td className="td text-xs font-mono whitespace-nowrap text-dark-muted">{fmtData(a.data_emissao)}</td>
                    <td className="td max-w-[140px] truncate font-medium text-dark-text">{resolverNome(a.imobiliaria) || '—'}</td>
                    <td className="td max-w-[220px] text-dark-text">
                      <div className="min-w-0">
                        <p className="truncate">{nomeFicha(a)}</p>
                        {isApoliceSemFicha(a) && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-status-warning/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-status-warning">
                            Apólice sem ficha vinculada
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td font-mono text-xs text-dark-muted">{a.numero_apolice || '—'}</td>
                    <td className="td text-xs text-dark-muted">{a.seguradora || '—'}</td>
                    <td className="td"><StatusBadge status={a.status_emissao} /></td>
                    <td className="td font-mono text-xs">{a.valor_parcela ? fmtBRL(a.valor_parcela) : '—'}</td>
                    <td className="td text-xs text-dark-muted">{a.profiles?.nome?.split(' ')[0] || '—'}</td>
                    <td className="td" onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate(`/apolices/${a.id}`)} className="rounded-lg border border-dark-border px-2 py-1 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-dark-border px-4 py-3 text-xs text-dark-muted">
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="rounded-2xl border border-dark-border px-2.5 py-1 transition-colors hover:border-brand-accent/50 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= pages - 1}
                className="rounded-2xl border border-dark-border px-2.5 py-1 transition-colors hover:border-brand-accent/50 disabled:opacity-30"
              >
                Próximo →
              </button>
            </div>
          </div>
        )}
      </DataCard>
    </div>
  )
}
