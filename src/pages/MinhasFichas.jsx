import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchFichasDoOrcamentista, fetchFichasPassadasDoOrcamentista, fetchFichaDetalhe, deletarFicha, STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import ModalFinalizar from '../components/ModalFinalizar'
import ModalFicha from '../components/ModalFicha'
import DetalhesFicha from '../components/DetalhesFicha'
import { format, parseISO, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, CheckCircle2, FileText, TrendingUp, LayoutGrid, ListFilter, ArrowLeftRight } from 'lucide-react'
import { Select } from '../components/ui/Select'
import { PageHeader, MetricCard, DataCard, FilterBar, EmptyState } from '../components/ui'
import { TableSkeleton } from '../components/Skeleton'
import { Link } from 'react-router-dom'

function QuickDateFilter({ value, onChange }) {
  const opts = [
    { key: 'todos', label: 'Todos' },
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mês' },
  ]

  return (
    <div className="flex items-center gap-1 rounded-full border border-dark-border bg-dark-surface2/70 p-0.5">
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            value === o.key ? 'bg-brand-primary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
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
  const now = new Date()
  const from = filtro === 'hoje'
    ? startOfDay(now)
    : filtro === 'semana'
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfMonth(now)
  return fichas.filter(f => new Date(f.created_at) >= from)
}

function stringColor(str) {
  const c = ['#4A90D9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#2B5BA8']
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

function initials(n) {
  return (n || '').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?'
}

function TimeBadge({ since }) {
  const h = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60))
  const [cls, label] = h < 4
    ? ['bg-status-success/15 text-status-success', h < 1 ? '<1h' : `${h}h`]
    : h < 24
      ? ['bg-status-warning/15 text-status-warning', `${h}h`]
      : ['bg-status-danger/15 text-status-danger', `${Math.floor(h / 24)}d`]
  return <span className={`badge ${cls} font-mono`}>{label}</span>
}

export default function MinhasFichas() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const agora = new Date()
  const [tab, setTab] = useState('abertas')
  const [finalizar, setFinalizar] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [editar, setEditar] = useState(null)
  const [filtroAno, setFiltroAno] = useState(agora.getFullYear())
  const [filtroMes, setFiltroMes] = useState(agora.getMonth() + 1)
  const [filtroRapido, setFiltroRapido] = useState('todos')

  const queryClient = useQueryClient()
  const avatarColor = stringColor(profile?.nome || '')

  const { data: fichasData, isLoading } = useQuery({
    queryKey: ['minhas-fichas', user?.id, filtroAno, filtroMes],
    queryFn: async () => {
      const [abertasResult, passadasResult] = await Promise.allSettled([
        fetchFichasDoOrcamentista(user.id),
        fetchFichasPassadasDoOrcamentista(user.id, { ano: filtroAno, mes: filtroMes, pageSize: 500 }),
      ])

      return {
        abertas: abertasResult.status === 'fulfilled' ? abertasResult.value : [],
        passadas: passadasResult.status === 'fulfilled' ? passadasResult.value.data : [],
      }
    },
    enabled: !!user?.id,
  })

  const abertasRaw = fichasData?.abertas ?? []
  const passadas = fichasData?.passadas ?? []
  const abertas = useMemo(() => applyDateFilter(abertasRaw, filtroRapido), [abertasRaw, filtroRapido])

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['minhas-fichas', user?.id] })
  }

  async function handleEditar(fichaId) {
    const ficha = await fetchFichaDetalhe(fichaId)
    if (ficha) setEditar(ficha)
  }

  const metricas = {
    aprovadas: passadas.filter(f => f.status === 'aprovado').length,
    recusadas: passadas.filter(f => f.status === 'recusado').length,
    emitidas: passadas.filter(f => f.status === 'emitido').length,
    taxaAprovacao: passadas.length ? Math.round((passadas.filter(f => f.status === 'aprovado').length / passadas.length) * 100) : 0,
  }

  const anoOptions = [agora.getFullYear(), agora.getFullYear() - 1].map(y => ({ value: String(y), label: String(y) }))
  const mesOptions = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    .map((m, i) => ({ value: String(i + 1), label: m }))

  const stats = [
    { label: 'Em cotação', value: abertas.length, hint: 'Responsabilidade atual', tone: 'warning', icon: <Clock className="w-4 h-4" /> },
    { label: 'Aprovadas', value: metricas.aprovadas, hint: 'Finalizadas com sucesso', tone: 'success', icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Finalizadas', value: passadas.length, hint: 'Histórico do período', tone: 'accent', icon: <FileText className="w-4 h-4" /> },
    { label: 'Taxa de aprovação', value: `${metricas.taxaAprovacao}%`, hint: 'Eficiência pessoal', tone: 'secondary', icon: <TrendingUp className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Fila pessoal"
        title="Minhas Fichas"
        description="Mesa individual do orçamentista com foco em cotação ativa, finalização rápida e histÃ³rico filtrado por período."
        actions={(
          <>
            <Link to="/fichas" className="btn-secondary flex items-center gap-2 text-sm min-h-[44px]">
              <ArrowLeftRight className="w-4 h-4" />
              Mesa geral
            </Link>
          </>
        )}
        stats={stats.map(item => (
          <MetricCard key={item.label} {...item} />
        ))}
      />

      <FilterBar
        actions={(
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted">Período</span>
            <Select
              value={String(filtroMes)}
              onChange={v => setFiltroMes(Number(v))}
              options={mesOptions}
              className="w-20"
            />
            <Select
              value={String(filtroAno)}
              onChange={v => setFiltroAno(Number(v))}
              options={anoOptions}
              className="w-[74px]"
            />
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('abertas')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${
              tab === 'abertas'
                ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Em Cotação
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5">{abertasRaw.length}</span>
          </button>
          <button
            onClick={() => setTab('passadas')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${
              tab === 'passadas'
                ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Finalizadas
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5">{passadas.length}</span>
          </button>
          {tab === 'abertas' && (
            <QuickDateFilter value={filtroRapido} onChange={setFiltroRapido} />
          )}
        </div>
      </FilterBar>

      <DataCard
        title={tab === 'abertas' ? 'Carteira em cotação' : 'Histórico finalizado'}
        subtitle={tab === 'abertas'
          ? `Mostrando ${abertas.length} ficha${abertas.length !== 1 ? 's' : ''} sob sua responsabilidade`
          : `Mostrando ${passadas.length} ficha${passadas.length !== 1 ? 's' : ''} no período selecionado`}
      >
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
                    <td colSpan={6} className="td py-0">
                      <EmptyState
                        title={tab === 'abertas' ? 'Nenhuma ficha em cotação' : 'Nenhuma ficha finalizada'}
                        description={tab === 'abertas'
                          ? 'Quando novas fichas entrarem na sua fila, elas aparecerão aqui.'
                          : 'O histÃ³rico desse período ainda está vazio.'}
                        icon={<FileText className="w-6 h-6" />}
                        className="py-12"
                      />
                    </td>
                  </tr>
                ) : (tab === 'abertas' ? abertas : passadas).map(f => {
                  const si = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
                  const nome = f.produto === 'pessoa_juridica' ? (f.nome_empresa || f.nome_interessado) : f.nome_interessado
                  return (
                    <tr key={f.id} className="table-row" onClick={() => setDetalhe(f.id)}>
                      <td className="td text-dark-muted text-xs font-mono whitespace-nowrap hidden sm:table-cell">
                        {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </td>
                      <td className="td font-medium text-dark-text max-w-[140px] truncate">{f.imobiliaria || '—'}</td>
                      <td className="td text-dark-text max-w-[140px] truncate">{nome || '—'}</td>
                      <td className="td text-dark-muted text-xs hidden sm:table-cell">{PRODUTO_LABELS[f.produto]}</td>
                      {tab === 'abertas' ? (
                        <>
                          <td className="td"><TimeBadge since={f.assumida_em || f.created_at} /></td>
                          <td className="td text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setFinalizar(f)}
                              className="text-xs px-3 py-1.5 rounded-xl bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors font-medium min-h-[36px]"
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
      </DataCard>

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



