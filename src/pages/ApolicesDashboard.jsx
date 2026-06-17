import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, PieChart, Pie,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, FileCheck, LayoutGrid, List, Coins, Sparkles, Crown } from 'lucide-react'

import { Select } from '../components/ui/Select'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { PRODUTO_LABELS } from '../lib/fichas'
import {
  fetchKPIsApolices,
  fetchApolicesPorDia,
  fetchTopImobiliariasApolices,
  fetchProducaoPorSeguradora,
  fetchProducaoPorProdutoSeguradora,
  formatMoneyBR,
} from '../lib/apolices'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const PRODUCT_COLORS = ['#000079', '#2247aa', '#7fbec4']
const SEG_COLORS = {
  'Porto Seguro': '#000079',
  'Tokio Marine': '#2247aa',
  TOO: '#4b6cc2',
  'Junto Seguros': '#0f766e',
  Potencial: '#7fbec4',
  Outras: '#6B7280',
}

const FILTERS = [
  { key: 'mes', label: 'Mês' },
  { key: 'q90', label: '90 dias' },
  { key: 'ano', label: 'Ano' },
  { key: 'total', label: 'Total' },
]

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
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="text-dark-text font-medium">{p.name}: {p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SegTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="glass-panel px-3 py-2 text-xs">
      <p className="text-dark-text font-semibold">{row.seguradora}</p>
      <p className="mt-1 text-dark-muted">{row.apolices} apólice{row.apolices === 1 ? '' : 's'}</p>
      <p className="mt-1 text-dark-text">{formatMoneyBR(row.value)}</p>
    </div>
  )
}

function ProdutoSegTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="glass-panel px-3 py-2 text-xs">
      <p className="text-dark-text font-semibold">{PRODUTO_LABELS[row.produto] || row.produto || 'Sem produto'}</p>
      <p className="mt-1 text-dark-muted">{row.seguradora || 'Sem seguradora'}</p>
      <p className="mt-1 text-dark-text">{formatMoneyBR(row.value)}</p>
    </div>
  )
}

function groupProdutoTotals(rows) {
  const map = new Map()
  rows.forEach(row => {
    const key = row.produto || 'sem_produto'
    const current = map.get(key) || {
      produto: key,
      label: PRODUTO_LABELS[key] || key || 'Sem produto',
      value: 0,
      apolices: 0,
    }
    current.value += Number(row.value) || 0
    current.apolices += Number(row.apolices) || 0
    map.set(key, current)
  })
  return [...map.values()].sort((a, b) => b.value - a.value)
}

function groupProdutoSeguradoras(rows, produto) {
  return rows
    .filter(item => item.produto === produto)
    .sort((a, b) => b.value - a.value)
}

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
  const [producaoProdutoSeg, setProducaoProdutoSeg] = useState([])
  const [filtroSeg, setFiltroSeg] = useState('mes')
  const [produtoAtivo, setProdutoAtivo] = useState('')
  const [loading, setLoading] = useState(true)

  const inicioMes = new Date(ano, mes - 1, 1).toISOString()
  const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString()
  const mesLabel = `${MONTHS[mes - 1]} ${ano}`

  const getRange = useCallback(() => {
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
    const [i, f] = getRange()
    Promise.all([
      fetchProducaoPorSeguradora(i, f),
      fetchProducaoPorProdutoSeguradora(i, f),
    ]).then(([seg, prodSeg]) => {
      setProducaoSeg(seg || [])
      setProducaoProdutoSeg(prodSeg || [])
    })
  }, [getRange])

  const produtos = useMemo(() => groupProdutoTotals(producaoProdutoSeg), [producaoProdutoSeg])
  const produtoSeguradoras = useMemo(() => groupProdutoSeguradoras(producaoProdutoSeg, produtoAtivo || produtos[0]?.produto || ''), [producaoProdutoSeg, produtoAtivo, produtos])

  useEffect(() => {
    if (!produtos.length) return
    if (!produtoAtivo || !produtos.some(p => p.produto === produtoAtivo)) {
      setProdutoAtivo(produtos[0].produto)
    }
  }, [produtos, produtoAtivo])

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

  if (loading) {
    return <div className="py-20 text-center text-sm text-dark-muted">Carregando...</div>
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Apólices"
        title="Dashboard de Apólices"
        description={`Leitura consolidada da operação em ${mesLabel}. Acompanhe produção total, por produto e por seguradora sem sair do fluxo.`}
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
            <MetricCard label={`Emitidas em ${MONTHS[mes - 1]}`} value={kpis?.mesSelecionado ?? '—'} hint={kpis?.variacaoMes != null ? `${kpis.variacaoMes >= 0 ? '+' : ''}${kpis.variacaoMes}% vs mês anterior` : 'mês selecionado'} tone="accent" icon={<FileCheck className="h-4 w-4" />} />
            <MetricCard label="Últimos 90 dias" value={kpis?.ultimos90 ?? '—'} hint="janela recente" tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Total emitidas" value={kpis?.totalGeral ?? '—'} hint="base acumulada" tone="success" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Comissão" value={formatMoneyBR(kpis?.totalComissao)} hint="prêmio líquido do período" tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Produção" value={formatMoneyBR(kpis?.totalProducao)} hint="prêmio total emitido" tone="warning" icon={<TrendingUp className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Filtra os gráficos por ano e mês">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
          <div className="flex flex-wrap items-center gap-1">
            {MONTHS.map((label, i) => (
              <button
                key={label}
                onClick={() => setMes(i + 1)}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  mes === i + 1 ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </DataCard>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <DataCard title={`Apólices por dia — ${mesLabel}`} subtitle="Movimento diário no período selecionado">
          {porDia.length > 0 && porDia.some(d => d.total > 0) ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={porDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradApolice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.accent} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={chartTheme.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                    tickFormatter={v => { try { return format(parseISO(v), 'dd/MM') } catch { return v } }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DarkTip />} />
                  <Area type="monotone" dataKey="total" name="Apólices" stroke={chartTheme.accent} fill="url(#gradApolice)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Nenhuma apólice emitida" description="Não houve movimentação suficiente para montar a série temporal." icon={<Coins className="w-6 h-6" />} />
          )}
        </DataCard>

        <DataCard
          title="Produção por seguradora"
          subtitle="Filtro alterna a janela usada nos comparativos por seguradora e produto"
          actions={(
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltroSeg(f.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
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
            <div className="space-y-3">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={producaoSeg} dataKey="value" nameKey="seguradora" cx="50%" cy="50%" innerRadius={24} outerRadius={42}>
                      {producaoSeg.map((entry, i) => (
                        <Cell key={entry.seguradora} fill={SEG_COLORS[entry.seguradora] || PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<SegTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {producaoSeg.slice(0, 5).map(item => (
                  <div key={item.seguradora} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEG_COLORS[item.seguradora] || chartTheme.gold }} />
                      <span className="text-dark-muted truncate max-w-[120px]">{item.seguradora}</span>
                    </div>
                    <span className="font-mono font-semibold text-dark-text">{formatMoneyBR(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Sem dados" description="Ajuste a janela temporal para visualizar a produção por seguradora." icon={<Sparkles className="w-6 h-6" />} />
          )}
        </DataCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <DataCard title="Produção por produto" subtitle="Valor total de produção capturado por produto na janela selecionada">
          {produtos.length > 0 ? (
            <div className="space-y-4">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={produtos} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkTip />} />
                    <Bar dataKey="value" name="Produção" radius={[8, 8, 0, 0]}>
                      {produtos.map((item, index) => (
                        <Cell key={item.produto} fill={PRODUCT_COLORS[index % PRODUCT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {produtos.map(item => (
                  <div key={item.produto} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/25 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-text">{item.label}</p>
                        <p className="text-xs text-dark-muted">{item.apolices} apólice{item.apolices === 1 ? '' : 's'}</p>
                      </div>
                      <span className="text-sm font-mono font-semibold text-dark-text">{formatMoneyBR(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Sem produção por produto" description="A janela atual não trouxe produção suficiente para quebrar por produto." icon={<Coins className="w-6 h-6" />} />
          )}
        </DataCard>

        <DataCard title="Produto x seguradora" subtitle="Selecione um produto e veja a produção por seguradora">
          {produtos.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {produtos.map(item => (
                  <button
                    key={item.produto}
                    onClick={() => setProdutoAtivo(item.produto)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      produtoAtivo === item.produto
                        ? 'bg-brand-secondary text-white'
                        : 'border border-dark-border text-dark-muted hover:text-dark-text hover:border-brand-accent/40'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={produtoSeguradoras} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.grid} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="seguradora" width={130} tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ProdutoSegTip />} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {produtoSeguradoras.map((item, index) => (
                        <Cell key={item.seguradora} fill={PRODUCT_COLORS[index % PRODUCT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {produtoSeguradoras.length > 0 ? (
                  produtoSeguradoras.map(item => (
                    <div key={item.seguradora} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/25 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-dark-text">{item.seguradora}</p>
                          <p className="text-xs text-dark-muted">{item.apolices} apólice{item.apolices === 1 ? '' : 's'}</p>
                        </div>
                        <span className="text-sm font-mono font-semibold text-dark-text">{formatMoneyBR(item.value)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Sem seguradoras nesse produto" description="O produto selecionado não possui produção na janela atual." icon={<Sparkles className="w-6 h-6" />} />
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="Sem produtos na janela" description="Não foi possível montar a segmentação por produto." icon={<Coins className="w-6 h-6" />} />
          )}
        </DataCard>
      </div>

      <DataCard title={`Top 5 Imobiliárias — ${mesLabel}`} subtitle="Ranking por volume emitido no período.">
        {topImob.length === 0 ? (
          <EmptyState title="Sem aprovações ranqueadas" description="Não houve aprovações suficientes para destacar imobiliárias nesta janela." icon={<Crown className="w-6 h-6" />} />
        ) : (
          <div className="space-y-3">
            {topImob.map((item, index) => (
              <div key={item.name} className="rounded-2xl border border-dark-border/60 bg-dark-surface2/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white" style={{ background: index === 0 ? chartTheme.accent : index === 1 ? chartTheme.violet : chartTheme.sky }}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-dark-text truncate">{resolverNome(item.name)}</p>
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
    </div>
  )
}
