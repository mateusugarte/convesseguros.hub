import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, CartesianGrid, Cell, LabelList,
} from 'recharts'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  fetchKPIs, fetchEmitidas, fetchFichasPorDia, fetchTopImobiliarias,
  fetchDistribuicaoStatus, fetchFichasPorProdutoMes, fetchMetricas,
  fetchAtividadeRecente, fetchFichasDoOrcamentista, fetchAprovacoesPorSeguradora,
  fetchRankingEquipeMensal, STATUS_LABELS, PRODUTO_LABELS,
} from '../lib/fichas'
import { findSeguradoraMetaByNome } from '../lib/seguradoras'
import { getEntityImageUrl } from '../lib/entityMedia'
import { AVATAR_COLORS, STATUS_CHART_COLORS } from '../design-system/tokens'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import ModalFinalizar from '../components/ModalFinalizar'
import { DashboardSkeleton } from '../components/Skeleton'
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BellRing, CheckCircle2,
  CircleAlert, Clock3, Crown, ExternalLink, RefreshCw, ShieldCheck, Sparkles,
  Target, TrendingUp, Users, Zap,
} from 'lucide-react'
import { DataCard, EmptyState, MetricCard, Button, PortalSelect } from '../components/ui'

const LS_KEY = 'dashboard-periodo'
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const APPROVAL_PERIODS = [
  { key: 'mes_atual', label: 'Mês atual' },
  { key: 'ultimos_3', label: 'Últimos 3 meses' },
  { key: 'ultimos_6', label: 'Últimos 6 meses' },
  { key: 'ano_atual', label: 'Ano atual' },
]

const APPROVAL_SEG_COLORS = {
  Porto: '#000079',
  Tokio: '#2247aa',
  Too: '#4b6cc2',
  Pottencial: '#7fbec4',
  Junto: '#0f766e',
  'Não informado': '#6B7280',
}

function stringColor(str) {
  let hash = 0
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name) {
  return (name || '').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || '?'
}

function toHourAge(dateString) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60))
}

function timeChip(dateString) {
  const hours = toHourAge(dateString)
  if (hours < 1) return { label: 'agora', className: 'bg-status-success/12 text-status-success border-status-success/15' }
  if (hours < 8) return { label: `${hours}h`, className: 'bg-status-success/12 text-status-success border-status-success/15' }
  if (hours < 24) return { label: `${hours}h`, className: 'bg-status-warning/12 text-status-warning border-status-warning/15' }
  return { label: `${Math.floor(hours / 24)}d`, className: 'bg-status-danger/12 text-status-danger border-status-danger/15' }
}

function buildAlerts({ kpis, metricas, minhasFichas, topImob }) {
  const alerts = []

  if ((metricas?.semResposta || 0) > 0) {
    alerts.push({
      id: 'sem-resposta',
      tone: 'warning',
      title: 'Pendências acima de 48h',
      description: `${metricas.semResposta} ficha(s) aguardando retorno sem resposta recente.`,
      action: { label: 'Ver fichas', href: '/fichas' },
    })
  }

  if ((kpis?.emAberto || 0) > 20) {
    alerts.push({
      id: 'backlog',
      tone: 'danger',
      title: 'Backlog operacional elevado',
      description: `${kpis.emAberto} fichas em aberto demandando triagem ou conclusão.`,
      action: { label: 'Abrir fichas', href: '/fichas' },
    })
  }

  const overdueMine = minhasFichas.filter(item => toHourAge(item.assumida_em || item.created_at) >= 24)
  if (overdueMine.length > 0) {
    alerts.push({
      id: 'minhas-atrasadas',
      tone: 'warning',
      title: 'Carteira pessoal envelhecendo',
      description: `${overdueMine.length} ficha(s) em cotação com 24h ou mais.`,
      action: { label: 'Minha carteira', href: '/minhas-fichas' },
    })
  }

  if ((topImob?.length || 0) === 0) {
    alerts.push({
      id: 'sem-aprovacoes',
      tone: 'neutral',
      title: 'Sem destaques no período',
      description: 'Ainda não há aprovações suficientes para ranquear imobiliárias neste recorte.',
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      tone: 'success',
      title: 'Operação sob controle',
      description: 'Não há alertas críticos neste momento. O fluxo segue dentro do esperado.',
    })
  }

  return alerts.slice(0, 4)
}

function DashboardTooltip({ active, payload, label, dateLabel }) {
  if (!active || !payload?.length) return null

  return (
    <div className="glass-panel px-3 py-2.5 min-w-[140px] text-xs">
      {label && (
        <p className="text-dark-muted mb-1.5">
          {dateLabel ? format(parseISO(label), "dd 'de' MMM", { locale: ptBR }) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map(item => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: item.color || item.fill }} />
            <span className="text-dark-text font-medium">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertCard({ alert, onNavigate }) {
  const tones = {
    success: {
      icon: <ShieldCheck className="w-4 h-4 text-status-success" />,
      shell: 'border-status-success/20 bg-status-success/6',
      actionClass: 'text-status-success hover:underline',
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-status-warning" />,
      shell: 'border-status-warning/20 bg-status-warning/6',
      actionClass: 'text-status-warning hover:underline',
    },
    danger: {
      icon: <CircleAlert className="w-4 h-4 text-status-danger" />,
      shell: 'border-status-danger/20 bg-status-danger/6',
      actionClass: 'text-status-danger hover:underline',
    },
    neutral: {
      icon: <BellRing className="w-4 h-4 text-status-info" />,
      shell: 'border-dark-border/70 bg-dark-surface2/40',
      actionClass: 'text-status-info hover:underline',
    },
  }

  const tone = tones[alert.tone] || tones.neutral

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone.shell}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-2xl border border-white/20 bg-dark-surface/50 flex items-center justify-center flex-shrink-0">
          {tone.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dark-text">{alert.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-dark-muted">{alert.description}</p>
          {alert.action && (
            <button
              type="button"
              onClick={() => onNavigate?.(alert.action.href)}
              className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${tone.actionClass}`}
            >
              {alert.action.label} <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [finalizar, setFinalizar] = useState(null)
  const [approvalSegLogos, setApprovalSegLogos] = useState({})

  const now = new Date()
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
  const [approvalPeriod, setApprovalPeriod] = useState('mes_atual')

  useEffect(() => {
    const syncToCurrentMonth = () => {
      const current = new Date()
      setFilterYear(current.getFullYear())
      setFilterMonth(current.getMonth() + 1)
    }

    syncToCurrentMonth()

    let timerId
    const schedule = () => {
      const current = new Date()
      const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 0, 0, 5, 0)
      timerId = window.setTimeout(() => {
        syncToCurrentMonth()
        schedule()
      }, Math.max(next.getTime() - current.getTime(), 1000))
    }

    schedule()

    const onFocus = syncToCurrentMonth
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncToCurrentMonth()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timerId) window.clearTimeout(timerId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const rangeStart = new Date(filterYear, filterMonth - 1, 1).toISOString()
  const rangeEnd = new Date(filterYear, filterMonth, 0, 23, 59, 59).toISOString()

  const approvalRange = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    if (approvalPeriod === 'mes_atual') {
      start.setDate(1); start.setHours(0, 0, 0, 0)
    } else if (approvalPeriod === 'ultimos_3') {
      start.setMonth(start.getMonth() - 2); start.setDate(1); start.setHours(0, 0, 0, 0)
    } else if (approvalPeriod === 'ultimos_6') {
      start.setMonth(start.getMonth() - 5); start.setDate(1); start.setHours(0, 0, 0, 0)
    } else {
      start.setMonth(0, 1); start.setHours(0, 0, 0, 0)
    }
    return { start: start.toISOString(), end: end.toISOString() }
  }, [approvalPeriod])

  const query = useQuery({
    queryKey: ['dashboard', user?.id, filterYear, filterMonth],
    queryFn: async () => {
      const [kpis, emitted, byDay, topImob, distribution, byProduct, metrics, activity, mine, ranking] = await Promise.all([
        fetchKPIs(rangeStart, rangeEnd),
        fetchEmitidas(rangeStart, rangeEnd),
        fetchFichasPorDia(30),
        fetchTopImobiliarias(5, rangeStart, rangeEnd),
        fetchDistribuicaoStatus(rangeStart, rangeEnd),
        fetchFichasPorProdutoMes(),
        fetchMetricas(),
        fetchAtividadeRecente(10),
        user ? fetchFichasDoOrcamentista(user.id) : Promise.resolve([]),
        fetchRankingEquipeMensal(rangeStart, rangeEnd),
      ])
      return { kpis, emitted, byDay, topImob, distribution, byProduct, metrics, activity, mine, ranking }
    },
  })

  const approvalQuery = useQuery({
    queryKey: ['dashboard-aprovacao-seguradora', approvalPeriod],
    queryFn: () => fetchAprovacoesPorSeguradora(approvalRange.start, approvalRange.end),
  })

  const data = query.data
  const kpis = data?.kpis ?? null
  const emitted = data?.emitted ?? 0
  const byDay = data?.byDay ?? []
  const topImob = data?.topImob ?? []
  const distribution = data?.distribution ?? []
  const byProduct = data?.byProduct ?? []
  const metrics = data?.metrics ?? null
  const activity = data?.activity ?? []
  const mine = data?.mine ?? []
  const ranking = data?.ranking ?? []
  const approvalSeg = approvalQuery.data ?? []

  useEffect(() => {
    let active = true
    if (!approvalSeg.length) {
      setApprovalSegLogos({})
      return () => { active = false }
    }

    Promise.all(approvalSeg.map(async item => {
      const meta = await findSeguradoraMetaByNome(item.seguradora)
      return [item.seguradora, getEntityImageUrl(meta?.logo_path, meta?.logo_url || null)]
    })).then(entries => {
      if (active) setApprovalSegLogos(Object.fromEntries(entries))
    }).catch(() => {
      if (active) setApprovalSegLogos({})
    })

    return () => { active = false }
  }, [approvalSeg])

  const chartTheme = useMemo(() => {
    const isDark = theme === 'dark'
    return {
      grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(8,15,44,0.08)',
      tick: isDark ? 'rgba(236,242,251,0.56)' : 'rgba(8,15,44,0.72)',
      accent: isDark ? '#c3f0f2' : '#000079',
      success: '#0f766e',
      gold: isDark ? '#7fbec4' : '#a2d6da',
      violet: '#4b6cc2',
      sky: '#2247aa',
      danger: '#8b1e4e',
    }
  }, [theme])

  const teamRanking = useMemo(() => ranking, [ranking])
  const alerts = useMemo(() => buildAlerts({ kpis, metricas: metrics, minhasFichas: mine, topImob }), [kpis, metrics, mine, topImob])
  const upcomingDeadlines = useMemo(() => [...mine].sort((a, b) => new Date(a.assumida_em || a.created_at) - new Date(b.assumida_em || b.created_at)).slice(0, 5), [mine])
  const periodLabel = `${MONTHS[filterMonth - 1]} ${filterYear}`
  const totalByDay = Math.max(...byDay.map(item => item.total), 0)
  const approvalsByDay = byDay.reduce((sum, item) => sum + item.aprovadas, 0)
  const refusalsByDay = byDay.reduce((sum, item) => sum + item.recusadas, 0)
  const updatedAt = format(new Date(), "dd/MM 'às' HH:mm", { locale: ptBR })

  if (query.isLoading) return <DashboardSkeleton />

  return (
    <div className="relative isolate min-h-full w-full space-y-6 animate-fade-in">
      <div className="pointer-events-none absolute inset-x-0 top-[-7rem] -z-10 h-[25rem] overflow-hidden" aria-hidden="true">
        <div className="absolute left-[8%] top-8 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="absolute right-[10%] top-10 h-80 w-80 rounded-full bg-brand-secondary/18 blur-3xl" />
        <div className="absolute inset-x-1/4 top-28 h-44 rounded-full bg-status-success/10 blur-3xl" />
      </div>

      <section className="ops-page-header p-6 md:p-8">
        <div className="relative z-[1] flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="ops-kicker">
              <Sparkles className="h-3.5 w-3.5" />
              Central de operação
            </div>
            <h1 className="title-display mt-4 max-w-2xl text-dark-text">
              Dashboard Geral
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-dark-muted md:text-base">
              Leitura única da operação para enxergar backlog, ritmo, risco e onde agir primeiro.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-dark-border/70 bg-dark-surface/70 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Janela ativa</p>
                <p className="mt-1 text-sm font-semibold text-dark-text">{periodLabel}</p>
              </div>
              <div className="rounded-2xl border border-dark-border/70 bg-dark-surface/70 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Atualizado</p>
                <p className="mt-1 text-sm font-semibold text-dark-text">{updatedAt}</p>
              </div>
              <div className="rounded-2xl border border-dark-border/70 bg-dark-surface/70 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Em aberto</p>
                <p className="mt-1 text-sm font-semibold text-dark-text">{kpis?.emAberto ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <PortalSelect
                value={filterMonth}
                onChange={value => setFilterMonth(Number(value))}
                options={MONTHS.map((month, index) => ({ value: index + 1, label: month }))}
                className="w-32"
              />
              <PortalSelect
                value={filterYear}
                onChange={value => setFilterYear(Number(value))}
                options={[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(year => ({ value: year, label: String(year) }))}
                className="w-28"
              />
              <Button variant="secondary" onClick={() => navigate('/fichas')} iconRight={<ArrowRight className="h-4 w-4" />}>
                Abrir fichas
              </Button>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Hoje" value={kpis?.hoje ?? '—'} hint="entrada do dia" icon={<Zap className="w-5 h-5" />} />
              <MetricCard label="Semana" value={kpis?.semana ?? '—'} hint="janela recente" tone="secondary" icon={<TrendingUp className="w-5 h-5" />} />
              <MetricCard label="Mês" value={kpis?.mes ?? '—'} hint="volume mensal" tone="warning" icon={<BarChart3 className="w-5 h-5" />} />
              <MetricCard label="Emitidas" value={emitted} hint="status emitido" tone="success" icon={<CheckCircle2 className="w-5 h-5" />} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        {alerts.slice(0, 3).map(alert => (
          <div key={alert.id} className="xl:col-span-4">
            <AlertCard alert={alert} onNavigate={href => navigate(href)} />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <DataCard className="xl:col-span-8 overflow-hidden" title="Tendência de entrada" subtitle="Volume e ritmo dos últimos 30 dias." actions={<div className="ops-kicker">30 dias</div>}>
          {byDay.length === 0 ? (
            <EmptyState title="Sem dados para o período" description="Não houve movimentação suficiente para montar a série temporal." icon={<Activity className="w-6 h-6" />} />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.35fr,0.85fr] rounded-[28px] border border-brand-accent/10 bg-[radial-gradient(circle_at_top_right,_rgba(74,144,217,0.10),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(15,118,110,0.08),_transparent_34%)] p-4">
              <div className="h-[320px] rounded-[24px] border border-dark-border/60 bg-dark-surface/60 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  <span className="rounded-full border border-brand-accent/20 bg-brand-accent/10 px-2.5 py-1 text-dark-text">Total</span>
                  <span className="rounded-full border border-status-success/20 bg-status-success/10 px-2.5 py-1 text-status-success">Aprovadas</span>
                  <span className="rounded-full border border-status-danger/20 bg-status-danger/10 px-2.5 py-1 text-status-danger">Recusadas</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={byDay} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboard-total" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartTheme.accent} stopOpacity={0.34} />
                        <stop offset="100%" stopColor={chartTheme.accent} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dashboard-approved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartTheme.success} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={chartTheme.success} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="dia" tickFormatter={value => format(parseISO(value), 'dd/MM', { locale: ptBR })} tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<DashboardTooltip dateLabel />} />
                    <Area type="monotone" dataKey="total" name="Total" stroke={chartTheme.accent} strokeWidth={2.75} fill="url(#dashboard-total)" dot={false} />
                    <Area type="monotone" dataKey="aprovadas" name="Aprovadas" stroke={chartTheme.success} strokeWidth={2.25} fill="url(#dashboard-approved)" dot={false} />
                    <Area type="monotone" dataKey="recusadas" name="Recusadas" stroke={chartTheme.danger} strokeWidth={1.8} fillOpacity={0} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 rounded-[24px] border border-dark-border/60 bg-dark-surface/60 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4 backdrop-blur-sm">
                  <p className="metric-label">Pico de entrada</p>
                  <p className="stat-number text-dark-text mt-3">{totalByDay}</p>
                  <p className="metric-sub mt-2">Maior volume diário observado na janela atual.</p>
                </div>
                <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4 backdrop-blur-sm">
                  <p className="metric-label">Aprovações na série</p>
                  <p className="stat-number text-dark-text mt-3">{approvalsByDay}</p>
                  <p className="metric-sub mt-2">Soma das aprovações registradas nos últimos 30 dias.</p>
                </div>
                <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4 backdrop-blur-sm">
                  <p className="metric-label">Recusas na série</p>
                  <p className="stat-number text-dark-text mt-3">{refusalsByDay}</p>
                  <p className="metric-sub mt-2">Leitura rápida para calibrar gargalo e qualidade de entrada.</p>
                </div>
              </div>
            </div>
          )}
        </DataCard>

        <DataCard className="xl:col-span-4" title="Radar operacional" subtitle="Sinais do período que pedem decisão rápida.">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Sem resposta</p>
              <p className="stat-number text-dark-text mt-3">{metrics?.semResposta ?? '—'}</p>
              <p className="metric-sub mt-2">acima de 48h.</p>
            </div>
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Tempo médio</p>
              <p className="stat-number text-dark-text mt-3">{metrics?.tempoMedio != null ? `${metrics.tempoMedio}h` : '—'}</p>
              <p className="metric-sub mt-2">entre assumir e finalizar.</p>
            </div>
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Aprovação</p>
              <p className="stat-number text-dark-text mt-3">{metrics ? `${metrics.taxaAprovacao}%` : '—'}</p>
              <p className="metric-sub mt-2">conversão das finalizadas.</p>
            </div>
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Recusa</p>
              <p className="stat-number text-dark-text mt-3">{metrics ? `${metrics.taxaRecusa}%` : '—'}</p>
              <p className="metric-sub mt-2">qualidade da entrada.</p>
            </div>
          </div>
        </DataCard>
      </div>

      <DataCard
        title="Aprovação por seguradora"
        subtitle="Distribuição das fichas aprovadas na janela escolhida."
        actions={(
          <div className="flex flex-wrap items-center gap-1.5">
            {APPROVAL_PERIODS.map(period => (
              <button
                key={period.key}
                onClick={() => setApprovalPeriod(period.key)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                  approvalPeriod === period.key
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'border border-dark-border text-dark-muted hover:text-dark-text hover:border-brand-accent/40'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
      >
        {approvalQuery.isLoading ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-dark-muted">Carregando aprovações...</div>
        ) : approvalSeg.every(item => item.value === 0) ? (
          <EmptyState title="Sem aprovações para o período" description="Ajuste a janela temporal para visualizar a distribuição por seguradora." icon={<Sparkles className="w-6 h-6" />} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={approvalSeg} layout="vertical" margin={{ top: 4, right: 44, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.grid} />
                  <XAxis type="number" tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="seguradora"
                    width={170}
                    axisLine={false}
                    tickLine={false}
                    tick={props => {
                      const name = props.payload?.value || ''
                      const logo = approvalSegLogos[name]
                      const color = APPROVAL_SEG_COLORS[name] || chartTheme.accent
                      return (
                        <g transform={`translate(${props.x},${props.y})`}>
                          <foreignObject x={-158} y={-16} width={152} height={32}>
                            <div className="flex items-center justify-end gap-2 pr-2">
                              <span className="text-[11px] font-medium text-dark-muted truncate max-w-[92px]">{name}</span>
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                              <div className="w-6 h-6 rounded-lg border border-dark-border/60 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                                {logo ? <img src={logo} alt={name} className="w-full h-full object-contain" /> : <span className="text-[9px] font-bold text-dark-muted">{name?.slice(0, 2)?.toUpperCase()}</span>}
                              </div>
                            </div>
                          </foreignObject>
                        </g>
                      )
                    }}
                  />
                  <Tooltip content={<DashboardTooltip />} cursor={{ fill: chartTheme.grid }} />
                  <Bar
                    dataKey="value"
                    name="% aprovadas"
                    radius={[0, 8, 8, 0]}
                    barSize={18}
                    background={{ fill: chartTheme.grid, radius: [0, 8, 8, 0] }}
                  >
                    {approvalSeg.map(item => (
                      <Cell key={item.seguradora} fill={APPROVAL_SEG_COLORS[item.seguradora] || chartTheme.accent} />
                    ))}
                    <LabelList dataKey="value" position="right" formatter={value => `${value}%`} fill={chartTheme.tick} fontSize={11} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {approvalSeg.map(item => (
                <div key={item.seguradora} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/25 px-4 py-3 shadow-[0_10px_25px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl border border-dark-border/60 bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                        {approvalSegLogos[item.seguradora] ? (
                          <img src={approvalSegLogos[item.seguradora]} alt={item.seguradora} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-bold text-dark-muted">{item.seguradora.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-dark-text truncate block">{item.seguradora}</span>
                        <span className="text-[11px] text-dark-muted">Aprovadas na janela escolhida</span>
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-dark-text font-mono">{item.value}%</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-dark-border/40">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(item.value, 100)}%`, background: APPROVAL_SEG_COLORS[item.seguradora] || chartTheme.accent }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-dark-muted">{item.total} ficha{item.total === 1 ? '' : 's'} aprovadas no período.</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DataCard>

      <div className="grid gap-6 xl:grid-cols-12">
        <DataCard className="xl:col-span-5" title="Top imobiliárias" subtitle="Aprovações concentradas no período selecionado." actions={<div className="ops-kicker">Top 5</div>}>
          {topImob.length === 0 ? (
            <EmptyState title="Sem aprovações ranqueadas" description="Ainda não houve aprovações suficientes para destacar imobiliárias nesta janela." icon={<Crown className="w-6 h-6" />} />
          ) : (
            <div className="space-y-3">
              {topImob.map((item, index) => (
                <div key={item.name} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/30 p-4 transition-all hover:border-brand-accent/25 hover:bg-brand-accent/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white" style={{ background: index === 0 ? chartTheme.accent : index === 1 ? chartTheme.violet : chartTheme.sky }}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-dark-text truncate">{item.name}</p>
                      <p className="text-xs text-dark-muted mt-1">Aprovações contabilizadas no período ativo.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-dark-text">{item.total}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">aprov.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        <DataCard className="xl:col-span-7" title="Atividade recente" subtitle="Últimas movimentações registradas no fluxo operacional." actions={(
          <button type="button" onClick={() => navigate('/fichas')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-info hover:underline">
            Ver todas <ExternalLink className="w-3 h-3" />
          </button>
        )}>
          {activity.length === 0 ? (
            <EmptyState title="Sem atividade recente" description="Assim que novas fichas entrarem ou mudarem de etapa, elas aparecerão aqui." icon={<Activity className="w-6 h-6" />} />
          ) : (
            <div className="space-y-2">
              {activity.map(item => {
                const statusMeta = STATUS_LABELS[item.status] ?? { label: item.status }
                const chip = timeChip(item.created_at)
                const owner = item.profiles?.nome || 'Livre'
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/fichas/${item.id}`)}
                    className="w-full rounded-2xl border border-dark-border/60 bg-dark-surface2/20 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-accent/30 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: stringColor(owner) }}>
                        {initials(owner)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-dark-text truncate">{item.nome_interessado || 'Sem nome'}</p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.className}`}>{chip.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-dark-muted truncate">
                          {item.imobiliaria || 'Sem imobiliária'} · {PRODUTO_LABELS[item.produto] || item.produto} · {owner}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: `${STATUS_CHART_COLORS[item.status] || chartTheme.gold}18`, color: STATUS_CHART_COLORS[item.status] || chartTheme.gold }}>
                          {statusMeta.label}
                        </span>
                        <p className="mt-1 text-[10px] text-dark-muted">
                          {formatDistanceToNow(parseISO(item.created_at), { locale: ptBR, addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <DataCard className="xl:col-span-5" title="Ranking da equipe" subtitle="Ranking mensal por usuario com base nas fichas aprovadas e nas emissões registradas no periodo selecionado." actions={<div className="ops-kicker">{periodLabel}</div>}>
          {teamRanking.length === 0 ? (
            <EmptyState title="Sem dados no período" description="O ranking mensal aparece assim que houver aprovações ou emissões atribuídas a usuarios." icon={<Users className="w-6 h-6" />} />
          ) : (
            <div className="space-y-3">
              {teamRanking.map((item, index) => (
                <div key={item.name} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/25 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: index === 0 ? chartTheme.accent : stringColor(item.name) }}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-dark-text truncate">{item.name}</p>
                      <p className="mt-1 text-xs text-dark-muted">{item.approved} aprovadas · {item.emitted} emissões no mês.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-dark-text">{item.total}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">ações</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        <DataCard className="xl:col-span-7" title="Fila de cotações" subtitle="Fichas em cotação sob sua responsabilidade, priorizadas por idade." actions={(
          <button type="button" onClick={() => navigate('/minhas-fichas')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-info hover:underline">
            Minha carteira <ExternalLink className="w-3 h-3" />
          </button>
        )}>
          {upcomingDeadlines.length === 0 ? (
            <EmptyState title="Nenhuma ficha em cotação" description="Quando houver fichas sob sua responsabilidade, elas serão priorizadas aqui." icon={<Clock3 className="w-6 h-6" />} />
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map(item => {
                const since = item.assumida_em || item.created_at
                const chip = timeChip(since)
                const owner = item.profiles?.nome || 'Sem responsável'
                return (
                  <div key={item.id} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/20 px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <button type="button" onClick={() => navigate(`/fichas/${item.id}`)} className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-dark-text truncate">{item.nome_interessado || 'Sem nome'}</p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.className}`}>{chip.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-dark-muted truncate">
                          {item.imobiliaria || 'Sem imobiliária'} · {item.seguradora || 'Seguradora pendente'} · {owner}
                        </p>
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 px-3 py-2 text-right">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">Assumida</p>
                          <p className="text-xs font-semibold text-dark-text">{format(parseISO(since), 'dd/MM HH:mm', { locale: ptBR })}</p>
                        </div>
                        <button type="button" onClick={() => setFinalizar(item)} className="btn-primary">
                          Finalizar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DataCard>
      </div>

      <DataCard title="Métricas operacionais" subtitle="Leituras de eficiência para acompanhar ritmo, backlog e resultado.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Taxa de aprovação</p>
                <p className="stat-number text-dark-text mt-3">{metrics ? `${metrics.taxaAprovacao}%` : '—'}</p>
              </div>
              <Target className="w-5 h-5 text-status-success" />
            </div>
            <p className="metric-sub mt-2">Indicador de conversão das fichas finalizadas.</p>
          </div>
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Taxa de recusa</p>
                <p className="stat-number text-dark-text mt-3">{metrics ? `${metrics.taxaRecusa}%` : '—'}</p>
              </div>
              <CircleAlert className="w-5 h-5 text-status-danger" />
            </div>
            <p className="metric-sub mt-2">Pressão de qualidade e ajuste da entrada comercial.</p>
          </div>
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Tempo médio</p>
                <p className="stat-number text-dark-text mt-3">{metrics?.tempoMedio != null ? `${metrics.tempoMedio}h` : '—'}</p>
              </div>
              <Clock3 className="w-5 h-5 text-status-info" />
            </div>
            <p className="metric-sub mt-2">Tempo médio entre assumir e finalizar fichas.</p>
          </div>
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Sem resposta</p>
                <p className="stat-number text-dark-text mt-3">{metrics?.semResposta ?? '—'}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-status-warning" />
            </div>
            <p className="metric-sub mt-2">Fichas pendentes acima de 48h sem retorno.</p>
          </div>
        </div>
      </DataCard>

      {byProduct.length > 0 && (
        <DataCard title="Produção por produto" subtitle="Comparativo por produto no mês atual.">
          {byProduct.every(item => item.total === 0) ? (
            <EmptyState title="Sem produção neste mês" description="Ainda não houve fichas suficientes para montar o comparativo por produto." icon={<Target className="w-6 h-6" />} />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProduct} margin={{ top: 12, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                  <XAxis dataKey="name" tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<DashboardTooltip />} />
                  <Bar dataKey="total" name="Total" radius={[8, 8, 0, 0]} fill={chartTheme.accent} />
                  <Bar dataKey="aprovadas" name="Aprovadas" radius={[8, 8, 0, 0]} fill={chartTheme.success} />
                  <Bar dataKey="recusadas" name="Recusadas" radius={[8, 8, 0, 0]} fill={chartTheme.danger} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DataCard>
      )}

      {distribution.length > 0 && (
        <DataCard title="Distribuição de status" subtitle="Distribuição das fichas no período selecionado.">
          <div className="space-y-4">
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" innerRadius={50} outerRadius={72} stroke="none" paddingAngle={3}>
                    {distribution.map(item => (
                      <Cell key={item.status} fill={STATUS_CHART_COLORS[item.status] || chartTheme.gold} />
                    ))}
                  </Pie>
                  <Tooltip content={<DashboardTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {distribution.slice(0, 5).map(item => (
                <div key={item.status} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_CHART_COLORS[item.status] || chartTheme.gold }} />
                  <span className="flex-1 truncate text-dark-muted">{item.label}</span>
                  <span className="font-mono font-semibold text-dark-text">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </DataCard>
      )}

      {finalizar && (
        <ModalFinalizar
          ficha={finalizar}
          onClose={() => setFinalizar(null)}
          onSuccess={() => {
            setFinalizar(null)
            query.refetch()
          }}
        />
      )}
    </div>
  )
}