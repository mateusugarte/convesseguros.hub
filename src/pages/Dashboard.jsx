import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, CartesianGrid,
} from 'recharts'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  fetchKPIs, fetchEmitidas, fetchFichasPorDia, fetchTopImobiliarias,
  fetchDistribuicaoStatus, fetchFichasPorProdutoMes, fetchMetricas,
  fetchAtividadeRecente, fetchFichasDoOrcamentista, STATUS_LABELS, PRODUTO_LABELS,
} from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import ModalFinalizar from '../components/ModalFinalizar'
import {
  TrendingUp, Clock, CheckCircle2, XCircle, AlertTriangle,
  BarChart3, Activity, Zap,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function stringColor(str) {
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) {
  return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?'
}

const STATUS_COLORS = {
  aprovado:     '#10B981',
  recusado:     '#EF4444',
  em_cotacao:   '#F59E0B',
  pendente:     '#3B82F6',
  emitido:      '#2B5BA8',
  em_analise:   '#4A90D9',
  cancelado:    '#8899BB',
  cpf_invalido: '#F59E0B',
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function DarkTip({ active, payload, label, dateLabel }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-surface2 border border-dark-border rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[120px]">
      {label && (
        <p className="text-dark-muted mb-1.5">
          {dateLabel ? (() => { try { return format(parseISO(label), "dd 'de' MMM", { locale: ptBR }) } catch { return label } })() : label}
        </p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-dark-text font-medium">{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-dark-muted uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: accent + '22' }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-dark-text font-mono">{value ?? '—'}</p>
      {sub && <p className="text-xs text-dark-muted">{sub}</p>}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-4 h-4 text-brand-accent" />}
      <h2 className="text-sm font-semibold text-dark-text">{title}</h2>
    </div>
  )
}

// ── Time badge ────────────────────────────────────────────────────────────────

function TimeBadge({ since }) {
  const h = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60))
  const [cls, label] = h < 4
    ? ['bg-status-success/15 text-status-success', h < 1 ? 'agora' : `${h}h`]
    : h < 24
    ? ['bg-status-warning/15 text-status-warning', `${h}h`]
    : ['bg-status-danger/15 text-status-danger', `${Math.floor(h/24)}d`]
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const { theme } = useTheme()

  const [kpis,         setKpis]         = useState(null)
  const [emitidas,     setEmitidas]     = useState(0)
  const [grafico,      setGrafico]      = useState([])
  const [topImob,      setTopImob]      = useState([])
  const [distribuicao, setDistribuicao] = useState([])
  const [prodMes,      setProdMes]      = useState([])
  const [metricas,     setMetricas]     = useState(null)
  const [atividade,    setAtividade]    = useState([])
  const [minhasFichas, setMinhasFichas] = useState([])
  const [finalizar,    setFinalizar]    = useState(null)

  const load = useCallback(async () => {
    const [k, em, g, ti, dist, pm, met, atv] = await Promise.all([
      fetchKPIs(), fetchEmitidas(), fetchFichasPorDia(30), fetchTopImobiliarias(5),
      fetchDistribuicaoStatus(), fetchFichasPorProdutoMes(), fetchMetricas(), fetchAtividadeRecente(10),
    ])
    setKpis(k); setEmitidas(em); setGrafico(g); setTopImob(ti)
    setDistribuicao(dist); setProdMes(pm); setMetricas(met); setAtividade(atv)
    if (user) fetchFichasDoOrcamentista(user.id).then(setMinhasFichas)
  }, [user])

  useEffect(() => { load() }, [load])

  // Theme-responsive chart colors
  const chartGrid = theme === 'dark' ? '#1E2D45' : '#C8D8F0'
  const chartTick = theme === 'dark' ? '#8899BB' : '#5A7099'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-dark-text">Dashboard</h1>
        <p className="text-xs text-dark-muted">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Hoje"        value={kpis?.hoje}     icon={Zap}         accent="#4A90D9" />
        <KPICard label="Esta Semana" value={kpis?.semana}   icon={TrendingUp}  accent="#8B5CF6" />
        <KPICard label="Este Mês"    value={kpis?.mes}      icon={BarChart3}   accent="#F59E0B" />
        <KPICard label="Em Aberto"   value={kpis?.emAberto} sub="pendente + cotação" icon={Clock} accent="#F59E0B" />
        <KPICard label="Emitidas"    value={emitidas}       sub="este mês"    icon={CheckCircle2} accent="#10B981" />
      </div>

      {/* ── Area chart ── */}
      <div className="card p-5">
        <SectionHeader title="Fichas por dia — últimos 30 dias" icon={Activity} />
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={grafico} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4A90D9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4A90D9" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gAprov" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
            <XAxis dataKey="dia"
                   tickFormatter={v => { try { return format(parseISO(v), 'dd/MM', { locale: ptBR }) } catch { return v } }}
                   tick={{ fill: chartTick, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: chartTick, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<DarkTip dateLabel />} />
            <Area type="monotone" dataKey="total"    name="Total"    stroke="#4A90D9" fill="url(#gTotal)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="aprovadas" name="Aprovadas" stroke="#10B981" fill="url(#gAprov)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Second row: donut + bar + metrics ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Donut — distribuição */}
        <div className="card p-5">
          <SectionHeader title="Distribuição por Status" />
          {distribuicao.length === 0 ? (
            <EmptyState message="Sem dados" />
          ) : (
            <div className="flex gap-4 items-center">
              <PieChart width={140} height={140}>
                <Pie data={distribuicao} cx={65} cy={65} innerRadius={42} outerRadius={62}
                     paddingAngle={2} dataKey="value" stroke="none">
                  {distribuicao.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.status] || '#8899BB'} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0]
                  return (
                    <div className="bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2 text-xs shadow-xl">
                      <p className="font-medium text-dark-text">{p.name}: {p.value}</p>
                    </div>
                  )
                }} />
              </PieChart>
              <div className="flex-1 space-y-1.5 min-w-0">
                {distribuicao.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[d.status] || '#8899BB' }} />
                    <span className="text-dark-muted flex-1 truncate">{d.label}</span>
                    <span className="text-dark-text font-mono font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar — Top imobiliárias */}
        <div className="card p-5">
          <SectionHeader title="Top 5 Imobiliárias" />
          {topImob.length === 0 ? (
            <EmptyState message="Nenhuma aprovação ainda" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={topImob} layout="vertical" margin={{ left: -15, right: 5 }}>
                <XAxis type="number" tick={{ fill: chartTick, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: chartTick, fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTip />} />
                <Bar dataKey="total" name="Aprovações" radius={[0, 4, 4, 0]}>
                  {topImob.map((_, i) => (
                    <Cell key={i} fill={`rgba(74, 144, 217, ${1 - i * 0.15})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick metrics */}
        <div className="card p-5">
          <SectionHeader title="Métricas" icon={BarChart3} />
          <div className="space-y-3">
            <MetricRow
              icon={<CheckCircle2 className="w-4 h-4 text-status-success" />}
              label="Taxa de Aprovação"
              value={metricas ? `${metricas.taxaAprovacao}%` : '—'}
              accent="text-status-success"
            />
            <MetricRow
              icon={<XCircle className="w-4 h-4 text-status-danger" />}
              label="Taxa de Recusa"
              value={metricas ? `${metricas.taxaRecusa}%` : '—'}
              accent="text-status-danger"
            />
            <MetricRow
              icon={<Clock className="w-4 h-4 text-brand-accent" />}
              label="Tempo Médio Cotação"
              value={metricas?.tempoMedio != null ? `${metricas.tempoMedio}h` : '—'}
              accent="text-brand-accent"
            />
            <MetricRow
              icon={<AlertTriangle className="w-4 h-4 text-status-warning" />}
              label="Sem Resposta +48h"
              value={metricas ? metricas.semResposta : '—'}
              accent={metricas?.semResposta > 0 ? 'text-status-warning' : 'text-dark-muted'}
            />
          </div>
        </div>
      </div>

      {/* ── Third row ── */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Fichas por produto (este mês) */}
        <div className="card p-5 lg:col-span-3">
          <SectionHeader title="Fichas por Produto — Este Mês" />
          {prodMes.every(p => p.total === 0) ? (
            <EmptyState message="Nenhuma ficha este mês" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={prodMes} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                <XAxis dataKey="name" tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DarkTip />} />
                <Bar dataKey="total"     name="Total"    fill="#2B5BA8" radius={[4,4,0,0]} />
                <Bar dataKey="aprovadas" name="Aprovadas" fill="#10B981" radius={[4,4,0,0]} />
                <Bar dataKey="recusadas" name="Recusadas" fill="#EF4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Minhas fichas em cotação */}
        <div className="card flex flex-col lg:col-span-2">
          <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dark-text">Minhas Fichas em Cotação</h2>
            <span className="badge bg-status-warning/15 text-status-warning">{minhasFichas.length}</span>
          </div>
          {minhasFichas.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-sm text-dark-muted text-center">Nenhuma ficha em cotação</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-48 divide-y divide-dark-border">
              {minhasFichas.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-dark-text truncate">{f.nome_interessado || '—'}</p>
                    <p className="text-[10px] text-dark-muted truncate">{f.imobiliaria || '—'}</p>
                  </div>
                  <TimeBadge since={f.assumida_em || f.created_at} />
                  <button
                    onClick={() => setFinalizar(f)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-brand-secondary/20 text-brand-accent border border-brand-accent/20 hover:bg-brand-secondary/40 transition-colors font-medium flex-shrink-0"
                  >
                    Finalizar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity feed ── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-dark-border">
          <h2 className="text-sm font-semibold text-dark-text">Atividade Recente</h2>
        </div>
        {atividade.length === 0 ? (
          <EmptyState message="Nenhuma ficha recebida ainda" className="py-8" />
        ) : (
          <div className="divide-y divide-dark-border">
            {atividade.map(f => {
              const si    = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
              const color = stringColor(f.profiles?.nome || '')
              const ago   = formatDistanceToNow(parseISO(f.created_at), { locale: ptBR, addSuffix: true })
              return (
                <div key={f.id} className="flex items-center gap-4 px-5 py-3 hover:bg-dark-surface2/50 transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                       style={{ background: color }}>
                    {initials(f.profiles?.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dark-text truncate font-medium">{f.nome_interessado || 'Sem nome'}</p>
                    <p className="text-xs text-dark-muted truncate">{f.imobiliaria} · {PRODUTO_LABELS[f.produto]}</p>
                  </div>
                  <span className={`badge ${si.color} flex-shrink-0`}>{si.label}</span>
                  <span className="text-[10px] text-dark-muted flex-shrink-0 hidden sm:block">{ago}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {finalizar && (
        <ModalFinalizar
          ficha={finalizar}
          onClose={() => setFinalizar(null)}
          onSuccess={() => { setFinalizar(null); load() }}
        />
      )}
    </div>
  )
}

function MetricRow({ icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-surface2/50">
      {icon}
      <span className="text-xs text-dark-muted flex-1">{label}</span>
      <span className={`text-sm font-bold font-mono ${accent}`}>{value}</span>
    </div>
  )
}

function EmptyState({ message, className = '' }) {
  return (
    <div className={`flex items-center justify-center text-dark-muted/60 text-sm ${className || 'h-32'}`}>
      {message}
    </div>
  )
}
