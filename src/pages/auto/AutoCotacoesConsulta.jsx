import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Car, Search, ShieldHalf } from 'lucide-react'
import { DataCard, EmptyState, PageHeader } from '../../components/ui'
import { atualizarStatusCotacao, getCotacoesAuto } from '../../lib/auto'
import { COTACAO_STATUS, formatDateTimeBR, formatMoney, formatPercent, toneClasses } from './autoShared'

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

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return <span className={`badge ${toneClasses(meta.tone)}`}>{meta.label}</span>
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-dark-muted">{label}</span>
      <span className="text-sm text-dark-text">{value}</span>
    </div>
  )
}

function statusToLabel(tipo) {
  return tipo === 'novo' ? 'Seguro novo' : 'Renovação'
}

export default function AutoCotacoesConsulta() {
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState('90d')
  const [searchLista, setSearchLista] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const qc = useQueryClient()

  const { data: todasCotacoes = [], isLoading } = useQuery({
    queryKey: ['auto-cotacoes-todas'],
    queryFn: () => getCotacoesAuto({}),
  })

  const { mutate: mudarStatus } = useMutation({
    mutationFn: ({ id, status }) => atualizarStatusCotacao(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] }),
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
        description="Pesquisa dedicada para revisar cotações com filtros de período, status e tipo, além de busca por cliente, veículo e seguradora."
        actions={(
          <Link to="/auto/cotacoes" className="btn-secondary">
            Voltar para recentes
          </Link>
        )}
      />

      <DataCard
        title="Área de consulta"
        subtitle="Use os filtros abaixo para localizar cotações específicas."
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
                placeholder="Buscar nome, CPF, veículo, placa ou seguradora..."
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
            {[{ value: 'todos', label: 'Todos os tipos' }, { value: 'novo', label: 'Seguro novo' }, { value: 'renovacao', label: 'Renovação' }].map(f => (
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
            {cotacoesFiltradas.map(item => {
              const isExpanded = expandedId === item.id
              return (
                <div key={item.id} className="transition-colors hover:bg-dark-surface2/30">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-dark-text">
                          {item.nome_cliente || item.cpf_cliente || 'Sem identificação'}
                        </p>
                        <QuoteStatusBadge status={item.status} />
                        <span className={`badge ${item.tipo === 'novo' ? 'badge-info' : 'badge-muted'}`}>
                          {statusToLabel(item.tipo)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-dark-muted">
                        {item.cpf_cliente && <span>CPF: {item.cpf_cliente}</span>}
                        {item.modelo_veiculo && <span>· {item.modelo_veiculo}{item.placa ? ` (${item.placa})` : ''}</span>}
                        {item.seguradora_preferencial?.nome && <span>· {item.seguradora_preferencial.nome}</span>}
                        {item.origem_lead && <span>· {item.origem_lead}</span>}
                        <span>· {formatDateTimeBR(item.created_at)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-dark-muted">
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-dark-border/50 bg-dark-surface2/20 px-5 py-5">
                      {item.tipo === 'novo' ? (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-muted">Segurado</p>
                            <InfoRow label="Nome" value={item.nome_cliente} />
                            <InfoRow label="CPF" value={item.cpf_cliente} />
                            <InfoRow label="Celular" value={item.celular_cliente} />
                            <InfoRow label="E-mail" value={item.email_cliente} />
                            <InfoRow label="Estado civil" value={item.estado_civil_cliente} />
                            <InfoRow label="Profissão" value={item.profissao_cliente} />
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-muted">Condutor</p>
                            <InfoRow label="Nome" value={item.condutor_nome} />
                            <InfoRow label="CPF" value={item.condutor_cpf} />
                            <InfoRow label="Estado civil" value={item.estado_civil_condutor} />
                            <InfoRow label="CEP pernoite" value={item.cep_pernoite} />
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-muted">Veículo e risco</p>
                            <InfoRow label="Modelo" value={item.modelo_veiculo} />
                            <InfoRow label="Placa" value={item.placa} />
                            <InfoRow label="Uso" value={item.uso_veiculo} />
                            <InfoRow label="Financiado" value={item.veiculo_financiado} />
                            <InfoRow label="Jovens 18-26" value={item.jovens_18_26} />
                            <InfoRow label="Garagem residência" value={item.garagem_residencia} />
                            <InfoRow label="Garagem trabalho" value={item.garagem_trabalho} />
                            <InfoRow label="Garagem estudo" value={item.garagem_estudo} />
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-muted">Proteções e lead</p>
                            <InfoRow label="Kit gás" value={item.possui_kit_gas} />
                            <InfoRow label="Blindagem" value={item.possui_blindagem} />
                            <InfoRow label="Isento imposto" value={item.isento_imposto} />
                            <InfoRow label="Origem lead" value={item.origem_lead} />
                            <InfoRow label="ID cliente" value={item.cliente_id} />
                            <InfoRow label="Criado em" value={formatDateTimeBR(item.created_at)} />
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-6 sm:grid-cols-3">
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-muted">Cliente</p>
                            <InfoRow label="CPF" value={item.cpf_cliente} />
                            <InfoRow label="ID cliente" value={item.cliente_id} />
                            <InfoRow label="Criado em" value={formatDateTimeBR(item.created_at)} />
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-muted">Seguradora preferencial</p>
                            <InfoRow label="Nome" value={item.seguradora_preferencial?.nome} />
                            <InfoRow label="Prêmio total" value={item.seguradora_preferencial?.premio_total ? formatMoney(item.seguradora_preferencial.premio_total) : null} />
                            <InfoRow label="Prêmio líquido" value={item.seguradora_preferencial?.premio_liquido ? formatMoney(item.seguradora_preferencial.premio_liquido) : null} />
                            <InfoRow label="% Comissão" value={item.seguradora_preferencial?.pct_comissao ? formatPercent(item.seguradora_preferencial.pct_comissao) : null} />
                            <InfoRow label="Comissão est." value={item.seguradora_preferencial?.valor_comissao ? formatMoney(item.seguradora_preferencial.valor_comissao) : null} />
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-muted">Seguradora mais barata</p>
                            <InfoRow label="Nome" value={item.seguradora_mais_barata?.nome} />
                            <InfoRow label="Prêmio total" value={item.seguradora_mais_barata?.premio_total ? formatMoney(item.seguradora_mais_barata.premio_total) : null} />
                            <InfoRow label="Prêmio líquido" value={item.seguradora_mais_barata?.premio_liquido ? formatMoney(item.seguradora_mais_barata.premio_liquido) : null} />
                            <InfoRow label="% Comissão" value={item.seguradora_mais_barata?.pct_comissao ? formatPercent(item.seguradora_mais_barata.pct_comissao) : null} />
                            <InfoRow label="Comissão est." value={item.seguradora_mais_barata?.valor_comissao ? formatMoney(item.seguradora_mais_barata.valor_comissao) : null} />
                          </div>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-2 border-t border-dark-border/50 pt-4">
                        <span className="mr-2 self-center text-xs text-dark-muted">Alterar status:</span>
                        {item.status !== 'convertida' && (
                          <button
                            onClick={() => mudarStatus({ id: item.id, status: 'convertida' })}
                            className="rounded-full border border-status-success/30 bg-status-success/10 px-3 py-1 text-xs font-medium text-status-success transition-colors hover:bg-status-success/20"
                          >
                            Marcar convertida
                          </button>
                        )}
                        {item.status !== 'perdida' && (
                          <button
                            onClick={() => mudarStatus({ id: item.id, status: 'perdida' })}
                            className="rounded-full border border-status-danger/30 bg-status-danger/10 px-3 py-1 text-xs font-medium text-status-danger transition-colors hover:bg-status-danger/20"
                          >
                            Marcar perdida
                          </button>
                        )}
                        {item.status !== 'pendente' && (
                          <button
                            onClick={() => mudarStatus({ id: item.id, status: 'pendente' })}
                            className="rounded-full border border-status-warning/30 bg-status-warning/10 px-3 py-1 text-xs font-medium text-status-warning transition-colors hover:bg-status-warning/20"
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DataCard>
    </div>
  )
}
