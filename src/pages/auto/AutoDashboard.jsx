import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  AlertTriangle,
  BellRing,
  CalendarDays,
  Car,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  Layers3,
  Megaphone,
  PhoneCall,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  getAutoRenovacaoMesStatus,
  getAutoPendingNotifications,
  getDashboardAutoMetrics,
  getGraficoCotacoesStatus,
  getGraficoEmissoesMensais,
} from '../../lib/auto'
import {
  AutoActionCard,
  AutoBadge,
  AutoInlineAlert,
  AutoPageHeader,
  AutoPanel,
  AutoStatStrip,
} from '../../components/auto'
import { EmptyState } from '../../components/ui'
import { getMesAlvoRenovacao } from './autoShared'

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0)
}

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthRef(monthRef) {
  const [year, month] = String(monthRef || '').split('-').map(Number)
  if (!year || !month) return 'mês atual'
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

function ChartTooltip({ active, payload, label, percentage = false }) {
  if (!active || !payload?.length) return null
  return (
    <div className="auto-chart-tooltip">
      <strong>{label}</strong>
      {payload.map(item => (
        <span key={item.dataKey}>
          <i style={{ background: item.color }} />
          {item.name}: <b>{percentage ? `${item.value}%` : item.value}</b>
        </span>
      ))}
    </div>
  )
}

function FinanceMetric({ label, current, previous, money = true }) {
  const currentValue = Number(current) || 0
  const previousValue = Number(previous) || 0
  const delta = currentValue - previousValue
  const percentage = previousValue ? Math.round((delta / previousValue) * 100) : null
  const formatter = money ? formatMoney : value => value

  return (
    <div className="auto-finance-metric">
      <span>{label}</span>
      <strong>{formatter(currentValue)}</strong>
      <div className={delta >= 0 ? 'is-positive' : 'is-negative'}>
        <TrendingUp aria-hidden="true" />
        <b>{delta >= 0 ? '+' : ''}{formatter(delta)}</b>
        {percentage !== null && <small>{percentage >= 0 ? '+' : ''}{percentage}%</small>}
      </div>
      <small>Anterior: {formatter(previousValue)}</small>
    </div>
  )
}

const PENDING_KIND_META = {
  cotacao_envio: { label: 'Cotação', icon: FileText, tone: 'amber' },
  emissao: { label: 'Emissão', icon: ClipboardCheck, tone: 'blue' },
  coletar_apolice: { label: 'Apólice', icon: ShieldCheck, tone: 'teal' },
  vistoria: { label: 'Vistoria', icon: ScanLine, tone: 'violet' },
  followup: { label: 'Follow-up', icon: PhoneCall, tone: 'coral' },
  cotacao_confirmacao: { label: 'Confirmar cotação', icon: FileText, tone: 'amber' },
  continuidade: { label: 'Continuidade', icon: ClipboardCheck, tone: 'blue' },
  lembrete: { label: 'Lembrete', icon: BellRing, tone: 'violet' },
}

const PENDING_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'urgent', label: 'Urgentes' },
  { id: 'cotacoes', label: 'Cotações' },
  { id: 'emissoes', label: 'Emissões' },
  { id: 'pos_venda', label: 'Pós-venda' },
  { id: 'followup', label: 'Follow-ups' },
  { id: 'lembretes', label: 'Lembretes' },
]

function matchesPendingFilter(item, filter) {
  if (filter === 'urgent') return item.priority === 'critical'
  if (filter === 'cotacoes') return ['cotacao_envio', 'cotacao_confirmacao'].includes(item.kind)
  if (filter === 'emissoes') return ['emissao', 'continuidade'].includes(item.kind)
  if (filter === 'pos_venda') return ['coletar_apolice', 'vistoria'].includes(item.kind)
  if (filter === 'followup') return item.kind === 'followup'
  if (filter === 'lembretes') return item.kind === 'lembrete'
  return true
}

export default function AutoDashboard() {
  const navigate = useNavigate()
  const [mesRef, setMesRef] = useState(currentMonthRef)
  const [pendingFilter, setPendingFilter] = useState('all')
  const monthLabel = useMemo(() => formatMonthRef(mesRef), [mesRef])

  const mesesParaChecarStatus = useMemo(() => {
    const hoje = new Date()
    return Array.from({ length: 4 }, (_, index) => {
      const date = new Date(hoje.getFullYear(), hoje.getMonth() - 2 + index, 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const { data: statusPorMes = {} } = useQuery({
    queryKey: ['auto-renovacao-mes-status', mesesParaChecarStatus],
    queryFn: () => getAutoRenovacaoMesStatus(mesesParaChecarStatus),
  })

  const mesAlvoRenovacao = useMemo(
    () => getMesAlvoRenovacao(new Date(), statusPorMes),
    [statusPorMes],
  )
  const mesAlvoLabel = useMemo(
    () => formatMonthRef(mesAlvoRenovacao || ''),
    [mesAlvoRenovacao],
  )

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['auto-dashboard-metrics', mesRef],
    queryFn: () => getDashboardAutoMetrics({ mes: mesRef }),
  })

  const { data: graficoEmissoes = [], isLoading: loadingEmissoes } = useQuery({
    queryKey: ['auto-grafico-emissoes', mesRef],
    queryFn: () => getGraficoEmissoesMensais(6, mesRef),
  })

  const { data: graficoCotacoes = [], isLoading: loadingCotacoes } = useQuery({
    queryKey: ['auto-grafico-cotacoes-status', mesRef],
    queryFn: () => getGraficoCotacoesStatus(6, mesRef),
  })

  const { data: pendingItems = [], isLoading: loadingPending, isError: pendingFailed, error: pendingError, isFetching: refreshingPending, refetch: refetchPending } = useQuery({
    queryKey: ['auto-pendencias'],
    queryFn: () => getAutoPendingNotifications(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const loading = loadingMetrics || loadingEmissoes || loadingCotacoes
  const filteredPendingItems = useMemo(
    () => pendingItems.filter(item => matchesPendingFilter(item, pendingFilter)),
    [pendingItems, pendingFilter],
  )
  const criticalPendingCount = pendingItems.filter(item => item.priority === 'critical').length
  const followupPendingCount = pendingItems.filter(item => item.kind === 'followup').length
  const todayPendingCount = pendingItems.filter(item => item.dueLabel === 'Para hoje' || item.dueLabel === 'Entrou hoje').length
  const hasEmissoes = graficoEmissoes.some(item => item.novos || item.renovacoes || item.endossos)
  const hasCotacoes = graficoCotacoes.some(item => item.abertas || item.convertidas || item.perdidas)

  const tendenciaConversao = useMemo(() => graficoCotacoes.map(item => {
    const total = item.abertas + item.convertidas + item.perdidas
    return { ...item, taxa: total > 0 ? Math.round((item.convertidas / total) * 100) : 0 }
  }), [graficoCotacoes])

  const stats = [
    {
      key: 'cotacoes',
      label: 'Cotações abertas',
      value: loading ? '—' : metrics?.cotacoesNoMes ?? 0,
      hint: monthLabel,
      tone: 'info',
      icon: FileText,
    },
    {
      key: 'conversao',
      label: 'Conversão',
      value: loading ? '—' : `${metrics?.taxaConversao ?? 0}%`,
      hint: 'resultado comercial',
      tone: 'success',
      icon: Gauge,
    },
    {
      key: 'renovacoes',
      label: 'Renovações concluídas',
      value: loading ? '—' : metrics?.renovacoesConcluidas ?? 0,
      hint: 'carteira protegida',
      tone: 'renewal',
      icon: ShieldCheck,
    },
    {
      key: 'pendencias',
      label: 'Ação necessária',
      value: loadingPending || pendingFailed ? '—' : pendingItems.length,
      hint: 'tarefas operacionais',
      tone: pendingFailed ? 'danger' : pendingItems.length > 0 ? 'warning' : 'neutral',
      icon: Megaphone,
    },
    {
      key: 'comissao',
      label: 'Comissão do mês',
      value: loading ? '—' : formatMoney(metrics?.comissaoTotal),
      hint: 'valor emitido',
      tone: 'success',
      icon: CircleDollarSign,
    },
  ]

  return (
    <div className="auto-page auto-v2-page auto-dashboard-command">
      <AutoPageHeader
        context="Central de comando"
        title="Operação Auto"
        description={`Uma visão clara do ritmo comercial, da carteira e das decisões de ${monthLabel}.`}
        meta={(
          <>
            <AutoBadge tone="success" icon={Sparkles}>Operação sincronizada</AutoBadge>
            <AutoBadge>{metrics?.novosNoMes ?? 0} novos negócios</AutoBadge>
          </>
        )}
        actions={(
          <>
            <label className="auto-month-control">
              <CalendarDays aria-hidden="true" />
              <input
                type="month"
                value={mesRef}
                onChange={event => setMesRef(event.target.value || currentMonthRef())}
                aria-label="Mês analisado"
              />
            </label>
            <button type="button" onClick={() => navigate('/auto/cotacoes')} className="btn-primary auto-primary-action">
              <Plus aria-hidden="true" />
              Nova cotação
            </button>
          </>
        )}
      />

      {mesAlvoRenovacao && (
        <AutoInlineAlert
          tone="warning"
          icon={Megaphone}
          title={`Prepare a carteira de ${mesAlvoLabel}`}
          description="Antecipe os contatos e evite concentração de vencimentos na virada do mês."
          actions={(
            <button
              type="button"
              onClick={() => navigate(`/auto/renovacoes/puxar?mes=${mesAlvoRenovacao}`)}
              className="btn-primary inline-flex items-center gap-2"
            >
              Organizar agora
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        />
      )}

      <AutoStatStrip items={stats} className="auto-dashboard-stats" />

      <section className="auto-emission-type-strip" aria-label="Emissões por tipo no período">
        <div className="auto-emission-type-heading"><span>Produção contabilizada</span><strong>Emissões por tipo</strong><small>{monthLabel}</small></div>
        <div className="is-new"><FileText /><span><small>Seguro novo</small><strong>{metrics?.novosNoMes ?? 0}</strong></span></div>
        <div className="is-renewal"><RefreshCw /><span><small>Renovação</small><strong>{metrics?.renovacoesNoMes ?? 0}</strong></span></div>
        <div className="is-endorsement"><Layers3 /><span><small>Endosso</small><strong>{metrics?.endossosNoMes ?? 0}</strong></span></div>
      </section>

      <section className="auto-pending-center auto-v2-enter" aria-labelledby="auto-pending-title">
        <header className="auto-pending-header">
          <div className="auto-pending-heading">
            <span className="auto-pending-heading-icon"><BellRing aria-hidden="true" /></span>
            <div>
              <span>Central de pendências</span>
              <h2 id="auto-pending-title">Seu próximo trabalho, já priorizado</h2>
              <p>Cotações, emissões, apólices, vistorias e retornos que precisam de ação.</p>
            </div>
          </div>
          <div className="auto-pending-header-actions">
            <AutoBadge tone={criticalPendingCount ? 'warning' : 'success'}>
              {criticalPendingCount ? `${criticalPendingCount} crítica${criticalPendingCount === 1 ? '' : 's'}` : 'Sem atrasos críticos'}
            </AutoBadge>
            <button type="button" className="auto-pending-refresh" onClick={() => refetchPending()} disabled={refreshingPending} title="Atualizar pendências">
              <RefreshCw className={refreshingPending ? 'is-spinning' : ''} aria-hidden="true" />
              Atualizar
            </button>
          </div>
        </header>

        <div className="auto-pending-summary" aria-label="Resumo das pendências">
          <div className={criticalPendingCount ? 'is-critical' : 'is-clear'}><strong>{criticalPendingCount}</strong><span>atrasos críticos</span><small>{criticalPendingCount ? 'Resolva estes primeiro' : 'Nenhuma tarefa muito atrasada'}</small></div>
          <div className="is-today"><strong>{todayPendingCount}</strong><span>ações de hoje</span><small>Entraram ou vencem hoje</small></div>
          <div className="is-followup"><strong>{followupPendingCount}</strong><span>follow-ups</span><small>Retornos programados</small></div>
        </div>

        <nav className="auto-pending-filters" aria-label="Filtrar pendências">
          {PENDING_FILTERS.map(filter => {
            const count = pendingItems.filter(item => matchesPendingFilter(item, filter.id)).length
            return <button key={filter.id} type="button" className={pendingFilter === filter.id ? 'is-active' : ''} onClick={() => setPendingFilter(filter.id)}>{filter.label}<b>{count}</b></button>
          })}
        </nav>

        <div className="auto-pending-list" aria-live="polite">
          {loadingPending ? (
            <div className="auto-pending-loading"><span /><div><strong>Montando sua fila de trabalho</strong><small>Verificando prazos e etapas do AUTO…</small></div></div>
          ) : pendingFailed ? (
            <div className="auto-pending-empty is-error"><AlertTriangle aria-hidden="true" /><div><strong>Não foi possível carregar as pendências</strong><small>{pendingError?.message || 'Tente atualizar a central novamente.'}</small><button type="button" onClick={() => refetchPending()}>Tentar novamente</button></div></div>
          ) : filteredPendingItems.length === 0 ? (
            <div className="auto-pending-empty"><ShieldCheck aria-hidden="true" /><div><strong>{pendingItems.length ? 'Nenhuma pendência neste filtro' : 'Operação em dia'}</strong><small>{pendingItems.length ? 'Escolha outro filtro para ver as demais tarefas.' : 'Não encontramos tarefas vencidas ou aguardando ação.'}</small></div></div>
          ) : filteredPendingItems.map(item => {
            const meta = PENDING_KIND_META[item.kind] || PENDING_KIND_META.cotacao_envio
            const Icon = meta.icon
            return (
              <button key={item.id} type="button" className={`auto-pending-row is-${item.priority}`} onClick={() => navigate(item.href)}>
                <span className={`auto-pending-kind is-${meta.tone}`}><Icon aria-hidden="true" /></span>
                <div className="auto-pending-content">
                  <span>{meta.label}</span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </div>
                <div className="auto-pending-deadline">
                  <span className={`is-${item.priority}`}><Clock3 aria-hidden="true" />{item.dueLabel}</span>
                  <small>{item.actionLabel}</small>
                </div>
                <ArrowRight className="auto-pending-arrow" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="auto-intelligence-grid auto-v2-enter" aria-label="Inteligência operacional">
        <article className="auto-performance-orbit-card">
          <div className="auto-performance-copy">
            <span>Eficiência comercial</span>
            <h2>Conversão do período</h2>
            <p>Leitura imediata de quantas oportunidades avançaram para negócio fechado.</p>
            <button type="button" onClick={() => navigate('/auto/cotacoes')}>
              Analisar cotações
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <div
            className="auto-performance-orbit"
            style={{ '--auto-orbit-value': `${Math.max(0, Math.min(100, Number(metrics?.taxaConversao) || 0)) * 3.6}deg` }}
            aria-label={`${metrics?.taxaConversao ?? 0}% de conversão`}
          >
            <div>
              <strong>{metrics?.taxaConversao ?? 0}%</strong>
              <small>convertidas</small>
            </div>
          </div>
        </article>

        <article className="auto-priority-card">
          <header>
            <div>
              <span>Radar de prioridades</span>
              <h2>Onde agir primeiro</h2>
            </div>
            <AutoBadge tone={Number(metrics?.renovacoesPendentes) > 0 ? 'warning' : 'success'}>
              {Number(metrics?.renovacoesPendentes) > 0 ? 'Atenção necessária' : 'Operação em dia'}
            </AutoBadge>
          </header>
          <div className="auto-priority-list">
            <button type="button" onClick={() => navigate('/auto/renovacoes')}>
              <span className="is-amber"><RefreshCw aria-hidden="true" /></span>
              <div><strong>Renovações sem tratativa</strong><small>Carteira aguardando próxima ação</small></div>
              <b>{metrics?.renovacoesPendentes ?? 0}</b>
              <ArrowRight aria-hidden="true" />
            </button>
            <button type="button" onClick={() => navigate('/auto/renovacoes')}>
              <span className="is-coral"><CalendarDays aria-hidden="true" /></span>
              <div><strong>Vencimentos neste mês</strong><small>Prioridade de contato e proposta</small></div>
              <b>{metrics?.vencendoNoMes ?? 0}</b>
              <ArrowRight aria-hidden="true" />
            </button>
            <button type="button" onClick={() => navigate(`/auto/gestao?mes=${mesRef}`)}>
              <span className="is-blue"><Layers3 aria-hidden="true" /></span>
              <div><strong>Negócios no fluxo</strong><small>Cotações abertas no período</small></div>
              <b>{metrics?.cotacoesNoMes ?? 0}</b>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </article>
      </section>
      <section className="auto-command-section auto-v2-enter">
        <div className="auto-section-heading">
          <div>
            <span>Fluxos principais</span>
            <h2>O que você quer movimentar agora?</h2>
          </div>
          <small>Atalhos com contexto do período selecionado</small>
        </div>
        <div className="auto-action-grid auto-v2-stagger">
          <AutoActionCard
            icon={FileText}
            eyebrow="Comercial"
            title="Cotações"
            description="Crie propostas e acompanhe retornos."
            value={metrics?.cotacoesNoMes ?? 0}
            tone="info"
            onClick={() => navigate('/auto/cotacoes')}
          />
          <AutoActionCard
            icon={Layers3}
            eyebrow="Operação"
            title="Pipeline"
            description="Mova cada negócio até a emissão."
            value={metrics?.renovacoesPendentes ?? 0}
            tone="warning"
            onClick={() => navigate(`/auto/gestao?mes=${mesRef}`)}
          />
          <AutoActionCard
            icon={RefreshCw}
            eyebrow="Carteira"
            title="Renovações"
            description="Priorize vencimentos e proteja clientes."
            value={metrics?.vencendoNoMes ?? 0}
            tone="renewal"
            onClick={() => navigate('/auto/renovacoes')}
          />
          <AutoActionCard
            icon={Car}
            eyebrow="Relacionamento"
            title="Clientes e apólices"
            description="Consulte histórico, veículos e vigências."
            value={metrics?.novosNoMes ?? 0}
            tone="success"
            onClick={() => navigate('/auto/clientes')}
          />
        </div>
      </section>

      <div className="auto-dashboard-grid">
        <AutoPanel
          className="auto-chart-panel auto-chart-panel-wide"
          title="Ritmo de emissões"
          description="Seguro novo e renovação nos últimos seis meses."
          actions={<AutoBadge tone="info">6 meses</AutoBadge>}
        >
          {loadingEmissoes ? (
            <div className="auto-chart-loading"><span />Carregando movimento...</div>
          ) : !hasEmissoes ? (
            <EmptyState
              icon={<Car className="h-6 w-6" />}
              title="O ritmo aparece com as primeiras emissões"
              description="Os dados mensais serão comparados automaticamente."
            />
          ) : (
            <div className="auto-chart-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoEmissoes} margin={{ top: 12, right: 4, left: -22, bottom: 0 }} barGap={5}>
                  <CartesianGrid vertical={false} stroke="rgba(100,116,139,0.13)" strokeDasharray="4 6" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7c879c' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7c879c' }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(63,94,251,0.05)' }} content={<ChartTooltip />} />
                  <Bar dataKey="novos" name="Novos" fill="#3563e9" radius={[8, 8, 3, 3]} maxBarSize={26} />
                  <Bar dataKey="renovacoes" name="Renovações" fill="#0ea5a4" radius={[8, 8, 3, 3]} maxBarSize={26} />
                  <Bar dataKey="endossos" name="Endossos" fill="#8b5cf6" radius={[8, 8, 3, 3]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="auto-chart-legend">
            <span><i className="is-blue" />Seguro novo</span>
            <span><i className="is-teal" />Renovação</span>
            <span><i className="is-violet" />Endosso</span>
          </div>
        </AutoPanel>

        <AutoPanel
          className="auto-finance-panel"
          title="Saúde da renovação"
          description="Comparação direta com o mesmo mês do ciclo anterior."
        >
          <div className="auto-finance-stack">
            <FinanceMetric
              label="Comissão"
              current={metrics?.renovacoesComissaoMesAtual}
              previous={metrics?.renovacoesComissaoAnoAnterior}
            />
            <FinanceMetric
              label="Prêmio líquido"
              current={metrics?.renovacoesPremioLiquidoMesAtual}
              previous={metrics?.renovacoesPremioLiquidoAnoAnterior}
            />
          </div>
          <button type="button" onClick={() => navigate('/auto/renovacoes')} className="auto-panel-link">
            Abrir carteira de renovações
            <ArrowRight aria-hidden="true" />
          </button>
        </AutoPanel>

        <AutoPanel
          className="auto-chart-panel auto-conversion-panel"
          title="Conversão comercial"
          description="Percentual mensal de cotações que viraram negócio."
          actions={<AutoBadge tone="success">{metrics?.taxaConversao ?? 0}% no período</AutoBadge>}
        >
          {loadingCotacoes ? (
            <div className="auto-chart-loading"><span />Calculando conversão...</div>
          ) : !hasCotacoes ? (
            <EmptyState
              icon={<Gauge className="h-6 w-6" />}
              title="Ainda não há conversões para comparar"
              description="Atualize o resultado das cotações para formar a tendência."
            />
          ) : (
            <div className="auto-chart-canvas is-compact">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tendenciaConversao} margin={{ top: 16, right: 6, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="autoConversionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(100,116,139,0.13)" strokeDasharray="4 6" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7c879c' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7c879c' }} unit="%" domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip percentage />} />
                  <Area
                    type="monotone"
                    dataKey="taxa"
                    name="Conversão"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#autoConversionGradient)"
                    activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AutoPanel>
      </div>
    </div>
  )
}
