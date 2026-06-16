import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, CartesianGrid, Cell,
} from 'recharts'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  fetchKPIs, fetchEmitidas, fetchFichasPorDia, fetchTopImobiliarias,
  fetchDistribuicaoStatus, fetchFichasPorProdutoMes, fetchMetricas,
  fetchAtividadeRecente, fetchFichasDoOrcamentista, STATUS_LABELS, PRODUTO_LABELS,
} from '../lib/fichas'
import { AVATAR_COLORS, STATUS_CHART_COLORS } from '../design-system/tokens'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import ModalFinalizar from '../components/ModalFinalizar'
import { DashboardSkeleton } from '../components/Skeleton'
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BellRing, CalendarDays,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3,
  Crown, ShieldCheck, Sparkles, Target, TrendingUp, Users, Zap,
} from 'lucide-react'
import {
  DataCard,
  EmptyState,
  FilterBar,
  MetricCard,
  PageHeader,
  SectionHeading,
} from '../components/ui'

const LS_KEY = 'dashboard-periodo'
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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

function buildTeamRanking(activity) {
  const summary = new Map()

  activity.forEach(item => {
    const name = item.profiles?.nome || 'Sem responsavel'
    const current = summary.get(name) || {
      name,
      total: 0,
      latestAt: item.created_at,
      approved: 0,
      emitted: 0,
    }

    current.total += 1
    if (item.status === 'aprovado') current.approved += 1
    if (item.status === 'emitido') current.emitted += 1
    if (new Date(item.created_at) > new Date(current.latestAt)) current.latestAt = item.created_at
    summary.set(name, current)
  })

  return [...summary.values()]
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return new Date(b.latestAt) - new Date(a.latestAt)
    })
    .slice(0, 5)
}

function buildAlerts({ kpis, metricas, minhasFichas, topImob }) {
  const alerts = []

  if ((metricas?.semResposta || 0) > 0) {
    alerts.push({
      id: 'sem-resposta',
      tone: 'warning',
      title: 'Pendencias acima de 48h',
      description: `${metricas.semResposta} ficha(s) aguardando retorno sem resposta recente.`,
    })
  }

  if ((kpis?.emAberto || 0) > 20) {
    alerts.push({
      id: 'backlog',
      tone: 'danger',
      title: 'Backlog operacional elevado',
      description: `${kpis.emAberto} fichas em aberto demandando triagem ou conclusao.`,
    })
  }

  const overdueMine = minhasFichas.filter(item => toHourAge(item.assumida_em || item.created_at) >= 24)
  if (overdueMine.length > 0) {
    alerts.push({
      id: 'minhas-atrasadas',
      tone: 'warning',
      title: 'Carteira pessoal envelhecendo',
      description: `${overdueMine.length} ficha(s) em cotacao com 24h ou mais.`,
    })
  }

  if ((topImob?.length || 0) === 0) {
    alerts.push({
      id: 'sem-aprovacoes',
      tone: 'neutral',
      title: 'Sem destaques no periodo',
      description: 'Ainda nao ha aprovacoes suficientes para ranquear imobiliarias neste recorte.',
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      tone: 'success',
      title: 'Operacao sob controle',
      description: 'Nao ha alertas criticos neste momento. O fluxo segue dentro do esperado.',
    })
  }

  return alerts.slice(0, 4)
}

function MonthYearPicker({ year, month, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)
  const wrapRef = useRef(null)
  const now = new Date()
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  useEffect(() => {
    if (open) setViewYear(year)
  }, [open, year])

  useEffect(() => {
    if (!open) return
    function handler(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = `${MONTHS[month - 1]} ${year}`

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="btn-secondary min-w-[148px] justify-between"
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-brand-accent" />
          {label}
        </span>
        <ChevronDown className={`w-4 h-4 text-dark-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 glass-panel z-[60] p-3 w-[240px] animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewYear(current => Math.max(years[years.length - 1], current - 1))}
              disabled={viewYear <= years[years.length - 1]}
              className="btn-ghost p-1.5 disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-dark-text">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear(current => Math.min(years[0], current + 1))}
              disabled={viewYear >= years[0]}
              className="btn-ghost p-1.5 disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS.map((item, index) => {
              const active = viewYear === year && index + 1 === month
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    onChange(viewYear, index + 1)
                    setOpen(false)
                  }}
                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${active ? 'bg-brand-accent text-white shadow-sm' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2'}`}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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

function AlertCard({ alert }) {
  const tones = {
    success: {
      icon: <ShieldCheck className="w-4 h-4 text-status-success" />,
      shell: 'border-status-success/20 bg-status-success/6',
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-status-warning" />,
      shell: 'border-status-warning/20 bg-status-warning/6',
    },
    danger: {
      icon: <CircleAlert className="w-4 h-4 text-status-danger" />,
      shell: 'border-status-danger/20 bg-status-danger/6',
    },
    neutral: {
      icon: <BellRing className="w-4 h-4 text-brand-secondary" />,
      shell: 'border-dark-border/70 bg-dark-surface2/40',
    },
  }

  const tone = tones[alert.tone] || tones.neutral

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone.shell}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-2xl border border-white/20 bg-white/50 flex items-center justify-center flex-shrink-0">
          {tone.icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dark-text">{alert.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-dark-muted">{alert.description}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [finalizar, setFinalizar] = useState(null)

  const now = new Date()
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null }
  })()

  const [filterYear, setFilterYear] = useState(stored?.ano ?? now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(stored?.mes ?? now.getMonth() + 1)

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ ano: filterYear, mes: filterMonth }))
  }, [filterYear, filterMonth])

  const rangeStart = new Date(filterYear, filterMonth - 1, 1).toISOString()
  const rangeEnd = new Date(filterYear, filterMonth, 0, 23, 59, 59).toISOString()

  const query = useQuery({
    queryKey: ['dashboard', user?.id, filterYear, filterMonth],
    queryFn: async () => {
      const [kpis, emitted, byDay, topImob, distribution, byProduct, metrics, activity, mine] = await Promise.all([
        fetchKPIs(rangeStart, rangeEnd),
        fetchEmitidas(rangeStart, rangeEnd),
        fetchFichasPorDia(30),
        fetchTopImobiliarias(5, rangeStart, rangeEnd),
        fetchDistribuicaoStatus(rangeStart, rangeEnd),
        fetchFichasPorProdutoMes(),
        fetchMetricas(),
        fetchAtividadeRecente(10),
        user ? fetchFichasDoOrcamentista(user.id) : Promise.resolve([]),
      ])

      return {
        kpis,
        emitted,
        byDay,
        topImob,
        distribution,
        byProduct,
        metrics,
        activity,
        mine,
      }
    },
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

  const chartTheme = useMemo(() => {
    const isDark = theme === 'dark'
    return {
      grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(8,15,44,0.08)',
      tick: isDark ? 'rgba(236,242,251,0.56)' : 'rgba(8,15,44,0.72)',
      accent: isDark ? '#c3f0f2' : '#000079',
      accentSoft: isDark ? '#dcffff' : '#2247aa',
      success: '#0f766e',
      gold: isDark ? '#7fbec4' : '#a2d6da',
      violet: '#4b6cc2',
      sky: '#2247aa',
      danger: '#8b1e4e',
    }
  }, [theme])

  const teamRanking = useMemo(() => buildTeamRanking(activity), [activity])
  const alerts = useMemo(() => buildAlerts({ kpis, metricas: metrics, minhasFichas: mine, topImob }), [kpis, metrics, mine, topImob])
  const upcomingDeadlines = useMemo(
    () => [...mine].sort((a, b) => new Date(a.assumida_em || a.created_at) - new Date(b.assumida_em || b.created_at)).slice(0, 5),
    [mine],
  )
  const periodLabel = `${MONTHS[filterMonth - 1]} ${filterYear}`

  if (query.isLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Central de operacoes"
        title="Dashboard Geral"
        description="Uma leitura unica da operacao para priorizar backlog, monitorar produtividade, enxergar riscos e agir rapido nas fichas que precisam destravar."
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            <MonthYearPicker year={filterYear} month={filterMonth} onChange={(year, month) => { setFilterYear(year); setFilterMonth(month) }} />
            <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-accent/80">Janela ativa</p>
              <p className="mt-1 text-sm font-semibold text-dark-text">{periodLabel}</p>
            </div>
          </div>
        )}
        stats={(
          <>
            <MetricCard
              label="Fichas do dia"
              value={kpis?.hoje ?? '—'}
              hint="entrada operacional do dia"
              icon={<Zap className="w-5 h-5" />}
            />
            <MetricCard
              label="Fichas da semana"
              value={kpis?.semana ?? '—'}
              hint="volume consolidado na semana"
              icon={<TrendingUp className="w-5 h-5" />}
              tone="secondary"
            />
            <MetricCard
              label="Fichas do mes"
              value={kpis?.mes ?? '—'}
              hint="capacidade entregue no periodo"
              icon={<BarChart3 className="w-5 h-5" />}
              tone="warning"
            />
            <MetricCard
              label="Apolices emitidas"
              value={emitted}
              hint="status emitido no periodo"
              icon={<CheckCircle2 className="w-5 h-5" />}
              tone="success"
            />
          </>
        )}
      />

      <FilterBar
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-dark-border/70 bg-white/50 px-3 py-2 text-xs text-dark-muted">
              Atualizado em {format(new Date(), "dd/MM 'as' HH:mm", { locale: ptBR })}
            </div>
          </div>
        )}
      >
        <div className="rounded-2xl border border-dark-border/70 bg-white/60 px-4 py-3 min-w-[180px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Carteira aberta</p>
          <p className="mt-1 text-lg font-semibold text-dark-text">{kpis?.emAberto ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-dark-border/70 bg-white/60 px-4 py-3 min-w-[180px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Pendencias 48h+</p>
          <p className="mt-1 text-lg font-semibold text-dark-text">{metrics?.semResposta ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-dark-border/70 bg-white/60 px-4 py-3 min-w-[180px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Tempo medio</p>
          <p className="mt-1 text-lg font-semibold text-dark-text">{metrics?.tempoMedio != null ? `${metrics.tempoMedio}h` : '—'}</p>
        </div>
        <div className="rounded-2xl border border-dark-border/70 bg-white/60 px-4 py-3 min-w-[180px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Taxa de aprovacao</p>
          <p className="mt-1 text-lg font-semibold text-dark-text">{metrics ? `${metrics.taxaAprovacao}%` : '—'}</p>
        </div>
      </FilterBar>

      <div className="grid gap-6 xl:grid-cols-12">
        <DataCard
          className="xl:col-span-8"
          title="Main Analytics"
          subtitle="Fichas recebidas nos ultimos 30 dias com leitura paralela de aprovacoes e recusas."
          actions={<div className="ops-kicker">30 dias</div>}
        >
          {byDay.length === 0 ? (
            <EmptyState title="Sem dados para o periodo" description="Nao houve movimentacao suficiente para montar a serie temporal." icon={<Activity className="w-6 h-6" />} />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.4fr,0.8fr]">
              <div className="h-[320px]">
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
                    <XAxis
                      dataKey="dia"
                      tickFormatter={value => format(parseISO(value), 'dd/MM', { locale: ptBR })}
                      tick={{ fill: chartTheme.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<DashboardTooltip dateLabel />} />
                    <Area type="monotone" dataKey="total" name="Total" stroke={chartTheme.accent} strokeWidth={2.5} fill="url(#dashboard-total)" dot={false} />
                    <Area type="monotone" dataKey="aprovadas" name="Aprovadas" stroke={chartTheme.success} strokeWidth={2} fill="url(#dashboard-approved)" dot={false} />
                    <Area type="monotone" dataKey="recusadas" name="Recusadas" stroke={chartTheme.danger} strokeWidth={1.5} fillOpacity={0} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
                  <p className="metric-label">Pico de entrada</p>
                  <p className="stat-number text-dark-text mt-3">
                    {Math.max(...byDay.map(item => item.total), 0)}
                  </p>
                  <p className="metric-sub mt-2">Maior volume diario observado na janela atual.</p>
                </div>
                <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
                  <p className="metric-label">Aprovacoes na serie</p>
                  <p className="stat-number text-dark-text mt-3">
                    {byDay.reduce((sum, item) => sum + item.aprovadas, 0)}
                  </p>
                  <p className="metric-sub mt-2">Soma das aprovacoes registradas nos ultimos 30 dias.</p>
                </div>
                <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
                  <p className="metric-label">Recusas na serie</p>
                  <p className="stat-number text-dark-text mt-3">
                    {byDay.reduce((sum, item) => sum + item.recusadas, 0)}
                  </p>
                  <p className="metric-sub mt-2">Leitura rapida para calibrar gargalo e qualidade de entrada.</p>
                </div>
              </div>
            </div>
          )}
        </DataCard>

        <DataCard
          className="xl:col-span-4"
          title="Alerts"
          subtitle="O que pede atencao imediata na operacao."
          actions={<div className="ops-kicker">Prioridades</div>}
        >
          <div className="space-y-3">
            {alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
          </div>
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <DataCard
          className="xl:col-span-5"
          title="Hero Metrics"
          subtitle="Resumo executivo do que esta sendo entregue agora."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Volume total do periodo</p>
              <p className="stat-number text-dark-text mt-3">{kpis?.total ?? '—'}</p>
              <p className="metric-sub mt-2">Base total observada na janela selecionada.</p>
            </div>
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Taxa de recusa</p>
              <p className="stat-number text-dark-text mt-3">{metrics ? `${metrics.taxaRecusa}%` : '—'}</p>
              <p className="metric-sub mt-2">Leitura de risco para ajustes de triagem e proposta.</p>
            </div>
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Carteira pessoal</p>
              <p className="stat-number text-dark-text mt-3">{mine.length}</p>
              <p className="metric-sub mt-2">Fichas em cotacao sob responsabilidade do usuario.</p>
            </div>
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="metric-label">Imobiliarias em destaque</p>
              <p className="stat-number text-dark-text mt-3">{topImob.length}</p>
              <p className="metric-sub mt-2">Quantidade de nomes com aprovacao no periodo ativo.</p>
            </div>
          </div>
        </DataCard>

        <DataCard
          className="xl:col-span-4"
          title="Production Breakdown"
          subtitle="Comparativo por produto no mes atual."
        >
          {byProduct.every(item => item.total === 0) ? (
            <EmptyState title="Sem producao neste mes" description="Ainda nao houve fichas suficientes para montar o comparativo por produto." icon={<Target className="w-6 h-6" />} />
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

        <DataCard
          className="xl:col-span-3"
          title="Status Mix"
          subtitle="Distribuicao das fichas no periodo selecionado."
        >
          {distribution.length === 0 ? (
            <EmptyState title="Sem distribuicao disponivel" description="Nao ha fichas suficientes para distribuir status neste periodo." icon={<Sparkles className="w-6 h-6" />} />
          ) : (
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
          )}
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <DataCard
          className="xl:col-span-5"
          title="Imobiliarias Destaque"
          subtitle="Aprovacoes concentradas no periodo selecionado."
          actions={<div className="ops-kicker">Top 5</div>}
        >
          {topImob.length === 0 ? (
            <EmptyState title="Sem aprovacoes ranqueadas" description="Nao houve aprovacoes suficientes para destacar imobiliarias nesta janela." icon={<Crown className="w-6 h-6" />} />
          ) : (
            <div className="space-y-3">
              {topImob.map((item, index) => (
                <div key={item.name} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white" style={{ background: index === 0 ? chartTheme.accent : index === 1 ? chartTheme.violet : chartTheme.sky }}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-dark-text truncate">{item.name}</p>
                      <p className="text-xs text-dark-muted mt-1">Aprovacoes contabilizadas no periodo ativo.</p>
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

        <DataCard
          className="xl:col-span-7"
          title="Recent Activity"
          subtitle="Ultimas movimentacoes registradas no fluxo operacional."
        >
          {activity.length === 0 ? (
            <EmptyState title="Sem atividade recente" description="Assim que novas fichas entrarem ou mudarem de etapa, elas aparecerao aqui." icon={<Activity className="w-6 h-6" />} />
          ) : (
            <div className="space-y-2">
              {activity.map(item => {
                const statusMeta = STATUS_LABELS[item.status] ?? { label: item.status }
                const chip = timeChip(item.created_at)
                const owner = item.profiles?.nome || 'Livre'

                return (
                  <div key={item.id} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: stringColor(owner) }}
                      >
                        {initials(owner)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-dark-text truncate">{item.nome_interessado || 'Sem nome'}</p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.className}`}>{chip.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-dark-muted truncate">
                          {item.imobiliaria || 'Sem imobiliaria'} · {PRODUTO_LABELS[item.produto] || item.produto} · {owner}
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
                  </div>
                )
              })}
            </div>
          )}
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <DataCard
          className="xl:col-span-5"
          title="User Ranking"
          subtitle="Ranking recente derivado das ultimas 10 movimentacoes registradas."
          actions={<div className="ops-kicker">Recente</div>}
        >
          {teamRanking.length === 0 ? (
            <EmptyState title="Sem movimentacoes suficientes" description="O ranking aparece assim que houver atividade recente atribuida a usuarios." icon={<Users className="w-6 h-6" />} />
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
                      <p className="mt-1 text-xs text-dark-muted">
                        {item.approved} aprovadas · {item.emitted} emitidas nas ultimas movimentacoes.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-dark-text">{item.total}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">eventos</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        <DataCard
          className="xl:col-span-7"
          title="Upcoming Deadlines"
          subtitle="Fila prioritaria das fichas em cotacao mais envelhecidas."
        >
          {upcomingDeadlines.length === 0 ? (
            <EmptyState title="Nenhuma ficha em cotacao" description="Quando houver fichas sob responsabilidade do usuario, elas serao priorizadas aqui." icon={<Clock3 className="w-6 h-6" />} />
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map(item => {
                const since = item.assumida_em || item.created_at
                const chip = timeChip(since)
                const owner = item.profiles?.nome || 'Sem responsavel'

                return (
                  <div key={item.id} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/20 px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-dark-text truncate">{item.nome_interessado || 'Sem nome'}</p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.className}`}>{chip.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-dark-muted truncate">
                          {item.imobiliaria || 'Sem imobiliaria'} · {item.seguradora || 'Seguradora pendente'} · {owner}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-2xl border border-dark-border/70 bg-white/60 px-3 py-2 text-right">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">Assumida</p>
                          <p className="text-xs font-semibold text-dark-text">{format(parseISO(since), 'dd/MM HH:mm', { locale: ptBR })}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFinalizar(item)}
                          className="btn-primary"
                        >
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

      <DataCard title="Operational Metrics" subtitle="Leituras de eficiencia para acompanhar ritmo, backlog e resultado.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Taxa de aprovacao</p>
                <p className="stat-number text-dark-text mt-3">{metrics ? `${metrics.taxaAprovacao}%` : '—'}</p>
              </div>
              <Target className="w-5 h-5 text-status-success" />
            </div>
            <p className="metric-sub mt-2">Indicador de conversao das fichas finalizadas.</p>
          </div>

          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Taxa de recusa</p>
                <p className="stat-number text-dark-text mt-3">{metrics ? `${metrics.taxaRecusa}%` : '—'}</p>
              </div>
              <CircleAlert className="w-5 h-5 text-status-danger" />
            </div>
            <p className="metric-sub mt-2">Pressao de qualidade e ajuste da entrada comercial.</p>
          </div>

          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Tempo medio</p>
                <p className="stat-number text-dark-text mt-3">{metrics?.tempoMedio != null ? `${metrics.tempoMedio}h` : '—'}</p>
              </div>
              <Clock3 className="w-5 h-5 text-brand-accent" />
            </div>
            <p className="metric-sub mt-2">Tempo medio entre assumir e finalizar fichas.</p>
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
