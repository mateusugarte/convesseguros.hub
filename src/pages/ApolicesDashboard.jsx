import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select } from '../components/ui/Select'
import { PageHeader, MetricCard, DataCard } from '../components/ui'
import {
  fetchKPIsApolices, fetchApolicesPorDia,
  fetchTopImobiliariasApolices, fetchPorSeguradora,
} from '../lib/apolices'
import { useTheme } from '../contexts/ThemeContext'
import { useImobiliaria } from '../hooks/useImobiliaria'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, FileCheck, LayoutGrid, List } from 'lucide-react'
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

const SEG_COLORS = {
  'Porto Seguro': '#000079',
  'Tokio Marine': '#2247aa',
  TOO: '#4b6cc2',
  'Junto Seguros': '#0f766e',
  Potencial: '#7fbec4',
  Outras: '#6B7280',
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
      <span style={{ color: SEG_COLORS[d?.seguradora] || BRAND.primary }}>{d?.seguradora}: {d?.value}</span>
    </div>
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
  const [porSeg, setPorSeg] = useState([])
  const [filtroSeg, setFiltroSeg] = useState('mes')
  const [loading, setLoading] = useState(true)

  const inicioMes = new Date(ano, mes - 1, 1).toISOString()
  const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString()
  const mesLabel = `${MESES_FULL[mes - 1]} ${ano}`

  const getRangeSeguradora = useCallback(() => {
    if (filtroSeg === 'mes') return [inicioMes, fimMes]
    if (filtroSeg === 'q90') {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      return [d.toISOString(), null]
    }
    if (filtroSeg === 'ano') return [new Date(ano, 0, 1).toISOString(), new Date(ano, 11, 31, 23, 59, 59).toISOString()]
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
    fetchPorSeguradora(i, f).then(setPorSeg)
  }, [getRangeSeguradora])

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Apólices"
        title="Dashboard de Apólices"
        description={`Leitura consolidada da operação em ${mesLabel}. Acompanhe volume, concentração por seguradora e as imobiliárias mais ativas sem sair do fluxo.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
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
              label="Total geral"
              value={kpis?.totalGeral ?? '—'}
              hint="base acumulada"
              tone="success"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Variação"
              value={kpis?.variacaoMes != null ? `${kpis.variacaoMes >= 0 ? '+' : ''}${kpis.variacaoMes}%` : '—'}
              hint="comparativo mensal"
              tone={kpis?.variacaoMes >= 0 ? 'success' : 'warning'}
              icon={kpis?.variacaoMes >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Filtra os gráficos do dashboard por ano e mês." bodyClassName="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </DataCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataCard title={`Apólices por dia — ${mesLabel}`} bodyClassName="lg:col-span-2">
          {loading ? (
            <div className="h-[140px] flex items-center justify-center text-dark-muted text-sm">Carregando...</div>
          ) : porDia.length > 0 && porDia.some(d => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={porDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradApolice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: CHART_COLORS[theme].tick }}
                  tickFormatter={v => { try { return format(parseISO(v), 'dd/MM') } catch { return v } }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTip />} />
                <Area type="monotone" dataKey="total" name="Apólices" stroke={BRAND.primary} fill="url(#gradApolice)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-dark-muted text-sm">
              Nenhuma apólice emitida em {mesLabel}
            </div>
          )}
        </DataCard>

        <DataCard
          title="Por Seguradora"
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
          {porSeg.length > 0 ? (
            <div className="space-y-2">
              <ResponsiveContainer width="100%" height={90}>
                <PieChart>
                  <Pie data={porSeg} dataKey="value" nameKey="seguradora" cx="50%" cy="50%" innerRadius={24} outerRadius={42}>
                    {porSeg.map((entry, i) => (
                      <Cell key={i} fill={SEG_COLORS[entry.seguradora] || BRAND.gold} />
                    ))}
                  </Pie>
                  <Tooltip content={<SegTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1">
                {porSeg.slice(0, 4).map(s => (
                  <div key={s.seguradora} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEG_COLORS[s.seguradora] || BRAND.gold }} />
                      <span className="text-dark-muted truncate max-w-[90px]">{s.seguradora}</span>
                    </div>
                    <span className="font-mono font-semibold text-dark-text">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-dark-muted text-sm">Sem dados</div>
          )}
        </DataCard>
      </div>

      <DataCard title={`Top 5 Imobiliárias — ${mesLabel}`} subtitle="Ranking por volume emitido no período.">
        {topImob.length === 0 ? (
          <p className="text-sm text-dark-muted">Sem dados para o período</p>
        ) : (
          <ResponsiveContainer width="100%" height={topImob.length * 40 + 20}>
            <BarChart
              data={topImob.map(t => ({ ...t, nome: resolverNome(t.nome) || t.nome }))}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS[theme].tick }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: CHART_COLORS[theme].tick }} width={130} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [v, 'Apólices']} contentStyle={tooltipStyle(theme)} />
              <Bar dataKey="total" fill={BRAND.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </DataCard>
    </div>
  )
}
