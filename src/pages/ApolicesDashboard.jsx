import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select } from '../components/ui/Select'
import { PageHeader, MetricCard, DataCard } from '../components/ui'
import {
  fetchKPIsApolices, fetchApolicesPorDia,
  fetchTopImobiliariasApolices, fetchProducaoPorSeguradora,
  formatMoneyBR,
} from '../lib/apolices'
import { findSeguradoraMetaByNome } from '../lib/seguradoras'
import { useTheme } from '../contexts/ThemeContext'
import { useImobiliaria } from '../hooks/useImobiliaria'
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, FileCheck, LayoutGrid, List } from 'lucide-react'
import { BRAND, AVATAR_COLORS, PALETTE } from '../design-system/tokens'

const CHART_COLORS = {
  light: {
    grid: 'rgba(8,15,44,0.10)',
    tick: 'rgba(8,15,44,0.55)',
    line1: BRAND.primary,
    line2: '#2247aa',
    bar: BRAND.primary,
    tooltip: {
      background: 'rgba(255,255,255,0.90)',
      border: 'rgba(8,15,44,0.18)',
      color: 'rgba(8,15,44,0.90)',
    },
  },
  dark: {
    grid: 'rgba(220,255,255,0.10)',
    tick: 'rgba(220,255,255,0.55)',
    line1: '#c3f0f2',
    line2: '#7fbec4',
    bar: '#c3f0f2',
    tooltip: {
      background: 'rgba(10,16,30,0.92)',
      border: 'rgba(195,240,242,0.22)',
      color: 'rgba(236,242,251,0.92)',
    },
  },
}

const tooltipStyle = (theme) => ({
  background: CHART_COLORS[theme].tooltip.background,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${CHART_COLORS[theme].tooltip.border}`,
  borderRadius: '12px',
  color: CHART_COLORS[theme].tooltip.color,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
})

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toLocalYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getMonthRange(ano, mes) {
  return [
    toLocalYmd(new Date(ano, mes - 1, 1)),
    toLocalYmd(new Date(ano, mes, 0)),
  ]
}

const SEG_COLORS = {
  'Porto Seguro': '#003595',
  'Tokio Marine': '#FBBA00',
  'TOO': '#38BDF8',
  'TOO Seguros': '#38BDF8',
  'Junto Seguros': '#7C3AED',
  'Pottencial': '#F97316',
  'Potencial': '#F97316',
  'Outras': '#6B7280',
}

function DarkTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-panel px-3 py-2 text-xs">
      {label && (
        <p className="text-dark-muted mb-1">
          {(() => {
            try { return format(parseISO(label), 'dd/MM', { locale: ptBR }) } catch { return label }
          })()}
        </p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-dark-text font-medium">{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  )
}

function SegTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="glass-panel px-3 py-2 text-xs">
      <span style={{ color: SEG_COLORS[d?.seguradora] || BRAND.primary }}>
        {d?.seguradora}: {formatMoneyBR(d?.value)}
      </span>
    </div>
  )
}

function LogoTick({ x, y, payload, logos }) {
  const src = logos?.[payload.value]
  const shortName = (payload.value ?? '').split(' ')[0]
  return (
    <g transform={`translate(${x},${y})`}>
      {src ? (
        <image
          href={src}
          x={-22}
          y={5}
          width={44}
          height={32}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <text x={0} y={20} textAnchor="middle" fontSize={9} fill="#9CA3AF">
          {shortName}
        </text>
      )}
    </g>
  )
}

const FILTRO_SEG = [
  { key: 'mes', label: 'Mês' },
  { key: 'q90', label: '90 dias' },
  { key: 'ano', label: 'Ano' },
  { key: 'total', label: 'Total' },
]

export default function ApolicesDashboard() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { resolverNome } = useImobiliaria()
  const agora = new Date()

  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [kpis, setKpis] = useState(null)
  const [porDia, setPorDia] = useState([])
  const [topImob, setTopImob] = useState([])
  const [producaoSeg, setProducaoSeg] = useState([])
  const [filtroSeg, setFiltroSeg] = useState('mes')
  const [segLogos, setSegLogos] = useState({})
  const [loading, setLoading] = useState(true)

  const [inicioMes, fimMes] = getMonthRange(ano, mes)
  const mesLabel = `${MESES_FULL[mes - 1]} ${ano}`

  const getRangeSeguradora = useCallback(() => {
    if (filtroSeg === 'mes') return [inicioMes, fimMes]
    if (filtroSeg === 'q90') {
      const d = new Date()
      d.setDate(d.getDate() - 89)
      return [toLocalYmd(d), toLocalYmd(new Date())]
    }
    if (filtroSeg === 'ano') return [toLocalYmd(new Date(ano, 0, 1)), toLocalYmd(new Date(ano, 11, 31))]
    return [null, null]
  }, [filtroSeg, inicioMes, fimMes, ano])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [k, d, t] = await Promise.all([
      fetchKPIsApolices(inicioMes, fimMes),
      fetchApolicesPorDia(inicioMes, fimMes),
      fetchTopImobiliariasApolices(inicioMes, fimMes),
    ])
    setKpis(k)
    setPorDia(d)
    setTopImob(t)
    setLoading(false)
  }, [inicioMes, fimMes])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const [i, f] = getRangeSeguradora()
    fetchProducaoPorSeguradora(i, f).then(setProducaoSeg)
  }, [getRangeSeguradora])

  useEffect(() => {
    if (!producaoSeg.length) return
    Promise.all(
      producaoSeg.map(async s => {
        const meta = await findSeguradoraMetaByNome(s.seguradora)
        return [s.seguradora, meta?.logo_url || null]
      })
    ).then(entries => setSegLogos(Object.fromEntries(entries)))
  }, [producaoSeg])

  return (
    <div className="min-h-full w-full space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Apólices"
        title="Dashboard de Apólices"
        description={`Leitura consolidada da operação em ${mesLabel}. Acompanhe volume, concentração por seguradora e as imobiliárias mais ativas sem sair do fluxo.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(ano)}
              onChange={v => setAno(Number(v))}
              options={[agora.getFullYear(), agora.getFullYear() - 1].map(a => ({ value: String(a), label: String(a) }))}
              className="w-24"
            />
            <div className="flex items-center gap-1 flex-wrap">
              {MESES_ABBR.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setMes(i + 1)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    mes === i + 1 ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-text hover:bg-dark-surface2'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-dark-border/50" />
            <button
              onClick={() => navigate('/apolices/gestao')}
              className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Gestão
            </button>
            <button
              onClick={() => navigate('/apolices/lista')}
              className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text"
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
        )}
        stats={(
          <>
            <MetricCard
              label={`Emitidas em ${MESES_ABBR[mes - 1]}`}
              value={kpis?.mesSelecionado ?? '—'}
              hint={kpis?.variacaoMes != null ? `${kpis.variacaoMes >= 0 ? '+' : ''}${kpis.variacaoMes}% vs mês anterior` : 'mês selecionado'}
              tone="accent"
              icon={<FileCheck className="h-4 w-4" />}
            />
            <MetricCard
              label="Últimos 90 dias"
              value={kpis?.ultimos90 ?? '—'}
              hint="janela recente"
              tone="secondary"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Total emitidas"
              value={kpis?.totalGeral ?? '—'}
              hint="base acumulada"
              tone="success"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Produção"
              value={formatMoneyBR(kpis?.totalProducao)}
              hint="prêmio total emitido"
              tone="warning"
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataCard
          className="lg:col-span-2"
          title={`Apólices por dia — ${mesLabel}`}
          subtitle="Volume diário emitido no período selecionado."
        >
          {loading ? (
            <div className="h-[240px] flex items-center justify-center text-dark-muted text-sm">Carregando...</div>
          ) : porDia.length > 0 && porDia.some(d => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={porDia} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradApolice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS[theme].grid} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: CHART_COLORS[theme].tick }}
                  tickFormatter={v => { try { return format(parseISO(v), 'dd/MM') } catch { return v } }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART_COLORS[theme].tick }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<DarkTip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Apólices"
                  stroke={BRAND.primary}
                  fill="url(#gradApolice)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex flex-col items-center justify-center gap-2 text-dark-muted">
              <FileCheck className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhuma apólice emitida em {mesLabel}</p>
            </div>
          )}
        </DataCard>

        <DataCard
          title="Produção por Seguradora"
          subtitle="Prêmio total emitido no período."
          actions={(
            <div className="flex items-center gap-0.5">
              {FILTRO_SEG.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltroSeg(f.key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    filtroSeg === f.key ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        >
          {producaoSeg.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={producaoSeg} margin={{ top: 8, right: 4, left: -8, bottom: 52 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS[theme].grid} />
                <XAxis
                  dataKey="seguradora"
                  tick={(props) => <LogoTick {...props} logos={segLogos} />}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: CHART_COLORS[theme].tick }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  width={38}
                />
                <Tooltip content={<SegTip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {producaoSeg.map((entry, i) => (
                    <Cell key={i} fill={SEG_COLORS[entry.seguradora] || BRAND.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-dark-muted text-sm">Sem dados</div>
          )}
        </DataCard>
      </div>

      <DataCard title={`Top 5 Imobiliárias — ${mesLabel}`} subtitle="Ranking por volume emitido no período.">
        {topImob.length === 0 ? (
          <p className="text-sm text-dark-muted">Sem dados para o período</p>
        ) : (() => {
          const maxTotal = Math.max(...topImob.map(t => t.total), 1)
          const RANK_COLORS = [BRAND.primary, '#2247aa', '#4b6cc2', '#7fbec4', '#a2d6da']
          return (
            <div className="space-y-3">
              {topImob.map((item, index) => {
                const nome = resolverNome(item.nome) || item.nome
                const pct = Math.round((item.total / maxTotal) * 100)
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => navigate('/apolices/lista')}
                    className="w-full rounded-2xl border border-dark-border/60 bg-dark-surface2/20 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-accent/30 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                        style={{ background: RANK_COLORS[index] ?? BRAND.primary }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold text-dark-text truncate">{nome}</p>
                          <span className="text-sm font-bold text-dark-text flex-shrink-0">{item.total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-dark-border/40">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: RANK_COLORS[index] ?? BRAND.primary }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })()}
      </DataCard>
    </div>
  )
}
