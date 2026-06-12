import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchFichasDoOrcamentista, fetchFichas, fetchFichaDetalhe, deletarFicha, STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import ModalFinalizar from '../components/ModalFinalizar'
import ModalFicha from '../components/ModalFicha'
import DetalhesFicha from '../components/DetalhesFicha'
import { format, parseISO, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, CheckCircle2, FileText, TrendingUp } from 'lucide-react'
import { Select } from '../components/ui/Select'
import { TableSkeleton } from '../components/Skeleton'

// ── QuickDateFilter ───────────────────────────────────────────────────────────

function QuickDateFilter({ value, onChange }) {
  const opts = [
    { key: 'todos',  label: 'Todos' },
    { key: 'hoje',   label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes',    label: 'Mês' },
  ]
  return (
    <div className="flex items-center gap-1 bg-dark-surface2 border border-dark-border rounded-full p-0.5">
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            value === o.key
              ? 'bg-brand-secondary text-white shadow-sm'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function applyDateFilter(fichas, filtro) {
  if (filtro === 'todos') return fichas
  const now  = new Date()
  const from = filtro === 'hoje'
    ? startOfDay(now)
    : filtro === 'semana'
    ? startOfWeek(now, { weekStartsOn: 1 })
    : startOfMonth(now)
  return fichas.filter(f => new Date(f.created_at) >= from)
}

function stringColor(str) {
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) { return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?' }

function TimeBadge({ since }) {
  const h = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60))
  const [cls, label] = h < 4
    ? ['bg-status-success/15 text-status-success', h < 1 ? '<1h' : `${h}h`]
    : h < 24
    ? ['bg-status-warning/15 text-status-warning', `${h}h`]
    : ['bg-status-danger/15 text-status-danger', `${Math.floor(h/24)}d`]
  return <span className={`badge ${cls} font-mono`}>{label}</span>
}

export default function MinhasFichas() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const agora = new Date()
  const [tab,           setTab]          = useState('abertas')
  const [finalizar,     setFinalizar]    = useState(null)
  const [detalhe,       setDetalhe]      = useState(null)
  const [editar,        setEditar]       = useState(null)
  const [editarLoading, setEditarLoading] = useState(false)
  const [filtroAno,     setFiltroAno]    = useState(agora.getFullYear())
  const [filtroMes,     setFiltroMes]    = useState(agora.getMonth() + 1)
  const [filtroRapido,  setFiltroRapido] = useState('todos')

  const queryClient = useQueryClient()
  const avatarColor = stringColor(profile?.nome || '')

  const { data: fichasData, isLoading } = useQuery({
    queryKey: ['minhas-fichas', user?.id, filtroAno, filtroMes],
    queryFn: () => Promise.all([
      fetchFichasDoOrcamentista(user.id),
      fetchFichas({ tipo: 'passadas_por_mim', orcamentistaId: user.id, pageSize: 500, ano: filtroAno, mes: filtroMes }),
    ]).then(([ab, { data }]) => ({ abertas: ab, passadas: data })),
    enabled: !!user?.id,
  })

  const abertasRaw = fichasData?.abertas  ?? []
  const passadas   = fichasData?.passadas ?? []
  const abertas    = useMemo(() => applyDateFilter(abertasRaw, filtroRapido), [abertasRaw, filtroRapido])

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['minhas-fichas', user?.id] })
  }

  // Busca a ficha completa antes de abrir o modal de edição,
  // evitando que campos como celular, email, cep, etc. apareçam vazios
  // (a listagem de passadas só carrega campos parciais).
  async function handleEditar(fichaId) {
    setEditarLoading(true)
    const ficha = await fetchFichaDetalhe(fichaId)
    setEditarLoading(false)
    if (ficha) setEditar(ficha)
  }

  const metricas = {
    aprovadas:      passadas.filter(f => f.status === 'aprovado').length,
    recusadas:      passadas.filter(f => f.status === 'recusado').length,
    emitidas:       passadas.filter(f => f.status === 'emitido').length,
    taxaAprovacao:  passadas.length ? Math.round((passadas.filter(f => f.status === 'aprovado').length / passadas.length) * 100) : 0,
  }

  const MESES_PASSADAS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="dashboard-hero flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0 shadow-lg"
            style={{ background: avatarColor }}
          >
            {initials(profile?.nome)}
          </div>
          <div>
            <div className="section-kicker mb-2">Fila pessoal</div>
            <h1 className="title-display text-dark-text">Minhas Fichas</h1>
            <p className="section-lead mt-1">{profile?.nome}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="dashboard-hero-chip">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Em cotação</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{abertas.length}</p>
          </div>
          <div className="dashboard-hero-chip">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Finalizadas</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{passadas.length}</p>
          </div>
          <div className="dashboard-hero-chip">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Taxa aprovação</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{metricas.taxaAprovacao}%</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-tile flex items-center gap-3">
          <Clock className="w-5 h-5 text-status-warning flex-shrink-0" />
          <div>
            <p className="metric-label">Em Cotação</p>
            <p className="metric-value text-dark-text">{abertas.length}</p>
          </div>
        </div>
        <div className="metric-tile flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-status-success flex-shrink-0" />
          <div>
            <p className="metric-label">Aprovadas</p>
            <p className="metric-value text-status-success">{metricas.aprovadas}</p>
          </div>
        </div>
        <div className="metric-tile flex items-center gap-3">
          <FileText className="w-5 h-5 text-brand-accent flex-shrink-0" />
          <div>
            <p className="metric-label">Finalizadas</p>
            <p className="metric-value text-dark-text">{passadas.length}</p>
          </div>
        </div>
        <div className="metric-tile flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-status-success flex-shrink-0" />
          <div>
            <p className="metric-label">Taxa Aprovação</p>
            <p className="metric-value text-status-success">{metricas.taxaAprovacao}%</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="table-shell overflow-hidden">
        <div className="flex items-center justify-between border-b border-dark-border pr-4 flex-wrap gap-2">
          <div className="flex">
            {[['abertas','Em Cotação'], ['passadas','Finalizadas']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                  tab === k ? 'border-brand-accent text-brand-accent' : 'border-transparent text-dark-muted hover:text-dark-text'
                }`}
              >
                {l} {tab !== k && `(${k === 'abertas' ? abertasRaw.length : passadas.length})`}
              </button>
            ))}
          </div>
          {/* Filtro rápido — visível apenas na aba abertas */}
          {tab === 'abertas' && (
            <QuickDateFilter value={filtroRapido} onChange={setFiltroRapido} />
          )}
        </div>

        {/* Filtro mês/ano — visível apenas na aba de fichas passadas */}
        {tab === 'passadas' && (
          <div className="flex items-center gap-2 px-4 pt-3 mb-1">
            <span className="text-xs text-dark-muted">Período:</span>
            <Select
              value={String(filtroMes)}
              onChange={v => setFiltroMes(Number(v))}
              options={MESES_PASSADAS.map((m, i) => ({ value: String(i+1), label: m }))}
              className="w-20"
            />
            <Select
              value={String(filtroAno)}
              onChange={v => setFiltroAno(Number(v))}
              options={[agora.getFullYear(), agora.getFullYear()-1].map(y => ({ value: String(y), label: String(y) }))}
              className="w-[74px]"
            />
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={6} cols={tab === 'abertas' ? 5 : 6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead border-b border-dark-border">
                <tr>
                  {tab === 'abertas' ? (
                    <>
                      <th className="th hidden sm:table-cell">Data</th>
                      <th className="th">Imobiliária</th>
                      <th className="th">Nome</th>
                      <th className="th hidden sm:table-cell">Produto</th>
                      <th className="th">Tempo</th>
                      <th className="th" />
                    </>
                  ) : (
                    <>
                      <th className="th hidden sm:table-cell">Data</th>
                      <th className="th">Imobiliária</th>
                      <th className="th">Nome</th>
                      <th className="th hidden sm:table-cell">Produto</th>
                      <th className="th">Status</th>
                      <th className="th hidden md:table-cell">Seguradora</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {(tab === 'abertas' ? abertas : passadas).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="td text-center text-dark-muted py-10">
                      {tab === 'abertas' ? 'Nenhuma ficha em cotação' : 'Nenhuma ficha finalizada ainda'}
                    </td>
                  </tr>
                ) : (tab === 'abertas' ? abertas : passadas).map(f => {
                  const si = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
                  return (
                    <tr key={f.id} className="table-row" onClick={() => setDetalhe(f.id)}>
                      <td className="td text-dark-muted text-xs font-mono whitespace-nowrap hidden sm:table-cell">
                        {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </td>
                      <td className="td font-medium text-dark-text max-w-[140px] truncate">{f.imobiliaria || '—'}</td>
                      <td className="td text-dark-text max-w-[140px] truncate">{f.nome_interessado || '—'}</td>
                      <td className="td text-dark-muted text-xs hidden sm:table-cell">{PRODUTO_LABELS[f.produto]}</td>
                      {tab === 'abertas' ? (
                        <>
                          <td className="td"><TimeBadge since={f.assumida_em || f.created_at} /></td>
                          <td className="td text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setFinalizar(f)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors font-medium min-h-[36px] sm:min-h-0"
                            >
                              Finalizar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="td"><span className={`badge ${si.color}`}>{si.label}</span></td>
                          <td className="td text-dark-muted text-xs hidden md:table-cell">{f.seguradora || '—'}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {finalizar && (
        <ModalFinalizar ficha={finalizar} onClose={() => setFinalizar(null)} onSuccess={() => { setFinalizar(null); refresh() }} />
      )}
      {detalhe && (
        <DetalhesFicha
          id={detalhe}
          onClose={() => setDetalhe(null)}
          onEdit={f => { setDetalhe(null); handleEditar(f.id) }}
          onDelete={async id => {
            await deletarFicha(id)
            setDetalhe(null)
            toast({ type: 'success', title: 'Ficha excluída' })
            refresh()
          }}
        />
      )}
      {editar && (
        <ModalFicha
          ficha={editar}
          onClose={() => setEditar(null)}
          onSuccess={() => { setEditar(null); refresh() }}
        />
      )}
    </div>
  )
}
