import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Car, Search } from 'lucide-react'
import { DataCard, EmptyState, PageHeader } from '../../components/ui'
import { getCotacoesAuto } from '../../lib/auto'
import { COTACAO_STATUS, formatDateTimeBR, toneClasses } from './autoShared'

const STATUS_FILTROS = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'convertida', label: 'Convertidas' },
  { value: 'perdida', label: 'Perdidas' },
]

const PERIODO_FILTROS = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '180d', label: '180 dias' },
  { value: 'todo', label: 'Todo período' },
]

const TIPO_FILTROS = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'novo', label: 'Seguro novo' },
  { value: 'renovacao', label: 'Renovação' },
]

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return <span className={`badge ${toneClasses(meta.tone)}`}>{meta.label}</span>
}

export default function AutoCotacoesConsulta() {
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState('90d')
  const [searchLista, setSearchLista] = useState('')

  const { data: todasCotacoes = [], isLoading } = useQuery({
    queryKey: ['auto-cotacoes-todas'],
    queryFn: () => getCotacoesAuto({}),
  })

  const cotacoesFiltradas = useMemo(() => {
    const hoje = new Date()
    const limitePeriodo = (() => {
      if (filtroPeriodo === 'todo') return null
      const dias = filtroPeriodo === '30d' ? 30 : filtroPeriodo === '90d' ? 90 : 180
      const dataLimite = new Date(hoje)
      dataLimite.setDate(dataLimite.getDate() - dias)
      return dataLimite
    })()

    const termo = searchLista.trim().toLowerCase()

    return todasCotacoes.filter(item => {
      if (limitePeriodo) {
        const created = new Date(item.created_at)
        if (Number.isNaN(created.getTime()) || created < limitePeriodo) return false
      }
      if (filtroStatus !== 'todas' && item.status !== filtroStatus) return false
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false
      if (!termo) return true

      const text = [
        item.nome_cliente,
        item.cpf_cliente,
        item.celular_cliente,
        item.modelo_veiculo,
        item.placa,
        item.seguradora_preferencial?.nome,
        item.seguradora_mais_barata?.nome,
        item.origem_lead,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return text.includes(termo)
    })
  }, [filtroPeriodo, filtroStatus, filtroTipo, searchLista, todasCotacoes])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seguro Auto"
        title="Consulta de cotações"
        description="Área dedicada para pesquisar cotações antigas com filtros de período, status, tipo e busca por cliente, veículo ou seguradora."
        actions={(
          <Link to="/auto/cotacoes" className="btn-secondary">
            Voltar para recentes
          </Link>
        )}
      />

      <DataCard
        title="Área de consulta"
        subtitle="Use os filtros para localizar uma cotação específica e abrir o detalhe completo."
        actions={(
          <span className="badge badge-muted">
            {cotacoesFiltradas.length} resultado{cotacoesFiltradas.length !== 1 ? 's' : ''}
          </span>
        )}
        bodyClassName="p-0"
      >
        <div className="border-b border-dark-border/70 bg-dark-surface2/25 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
              <input
                value={searchLista}
                onChange={e => setSearchLista(e.target.value)}
                placeholder="Buscar nome, CPF, celular, veículo, placa ou seguradora..."
                className="input pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {PERIODO_FILTROS.map(item => (
                <button
                  key={item.value}
                  onClick={() => setFiltroPeriodo(item.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filtroPeriodo === item.value
                      ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                      : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_FILTROS.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltroStatus(f.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filtroStatus === f.value
                    ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                    : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="mx-1 w-px bg-dark-border/70" />
            {TIPO_FILTROS.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltroTipo(f.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filtroTipo === f.value
                    ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                    : 'border-dark-border text-dark-muted hover:border-brand-secondary/40 hover:text-dark-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-dark-muted">Carregando cotações...</div>
        ) : cotacoesFiltradas.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<Car className="h-5 w-5" />}
              title="Nenhuma cotação encontrada"
              description="Ajuste os filtros ou volte para a tela principal para acompanhar as últimas cotações."
            />
          </div>
        ) : (
          <div className="divide-y divide-dark-border/70">
            {cotacoesFiltradas.map(item => (
              <Link
                key={item.id}
                to={`/auto/cotacoes/${item.id}`}
                className="block transition-colors hover:bg-dark-surface2/30"
              >
                <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-dark-text">
                        {item.nome_cliente || item.cpf_cliente || 'Sem identificação'}
                      </p>
                      <QuoteStatusBadge status={item.status} />
                      <span className={`badge ${item.tipo === 'novo' ? 'badge-info' : 'badge-muted'}`}>
                        {item.tipo === 'novo' ? 'Seguro novo' : 'Renovação'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-dark-muted">
                      {item.celular_cliente && <span>Celular: {item.celular_cliente}</span>}
                      {item.cpf_cliente && <span>CPF: {item.cpf_cliente}</span>}
                      {item.modelo_veiculo && <span>{item.modelo_veiculo}{item.placa ? ` (${item.placa})` : ''}</span>}
                      {item.seguradora_preferencial?.nome && <span>{item.seguradora_preferencial.nome}</span>}
                      {item.origem_lead && <span>{item.origem_lead}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-dark-muted">
                    <span>{formatDateTimeBR(item.created_at)}</span>
                    <span className="rounded-full border border-dark-border/70 px-3 py-1 text-dark-muted">
                      Abrir detalhe
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  )
}
