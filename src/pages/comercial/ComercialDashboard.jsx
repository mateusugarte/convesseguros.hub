import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, subQuarters, addDays, addWeeks, differenceInDays, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Activity, AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CircleDollarSign, FileCheck2,
  Funnel, Target, TrendingUp, Users,
} from 'lucide-react'
import { DatePicker } from '../../components/ui/DatePicker'
import { useAuth } from '../../contexts/AuthContext'
import { diffDias, ORIGENS, PIPELINE_COLS, useComercial } from '../../lib/comercial'
import {
  CrmAvatarBadge,
  CrmEmptyState,
  CrmMetricCard,
  CrmPageHeader,
  CrmSectionCard,
  CrmSegmentedControl,
} from '../../components/comercial'

const PERIOD_OPTIONS = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'mes_anterior', label: 'Último mês' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'personalizado', label: 'Personalizado' },
]

const SERIES_META = {
  leads: { label: 'Leads', color: '#2563EB' },
  vendas: { label: 'Vendas', color: '#10B981' },
  recusas: { label: 'Recusas', color: '#EF4444' },
}

function formatMoney(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function getPeriodoRange(tipo, de, ate) {
  const now = new Date()
  if (tipo === 'semana') return { de: startOfWeek(now, { weekStartsOn: 1 }), ate: now }
  if (tipo === 'mes') return { de: startOfMonth(now), ate: now }
  if (tipo === 'mes_anterior') return { de: startOfMonth(subMonths(now, 1)), ate: endOfMonth(subMonths(now, 1)) }
  if (tipo === 'trimestre') return { de: startOfQuarter(now), ate: now }
  if (tipo === 'personalizado' && de && ate) return { de: new Date(de), ate: new Date(`${ate}T23:59:59`) }
  return { de: startOfMonth(now), ate: now }
}

function getPrevRange(tipo, range) {
  if (!range) return null
  const duration = range.ate.getTime() - range.de.getTime()
  if (tipo === 'mes') return { de: startOfMonth(subMonths(range.de, 1)), ate: endOfMonth(subMonths(range.de, 1)) }
  if (tipo === 'mes_anterior') return { de: startOfMonth(subMonths(range.de, 1)), ate: endOfMonth(subMonths(range.de, 1)) }
  if (tipo === 'trimestre') return { de: startOfQuarter(subQuarters(range.de, 1)), ate: endOfQuarter(subQuarters(range.de, 1)) }
  return { de: new Date(range.de.getTime() - duration), ate: new Date(range.ate.getTime() - duration) }
}

function inRange(iso, range) {
  if (!iso || !range) return false
  const date = new Date(iso)
  return date >= range.de && date <= range.ate
}

function deltaPct(current, previous) {
  if (!previous) return current > 0  100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function remainingBusinessDays() {
  const now = new Date()
  const end = endOfMonth(now)
  let total = 0
  let cursor = addDays(now, 1)
  while (cursor <= end) {
    const weekday = cursor.getDay()
    if (weekday !== 0 && weekday !== 6) total += 1
    cursor = addDays(cursor, 1)
  }
  return total
}

function buildTrendData(leads, sales, range) {
  if (!range) return []

  const days = differenceInDays(range.ate, range.de) + 1
  const groupedByDay = days <= 35
  const buckets = []

  if (groupedByDay) {
    let cursor = new Date(range.de)
    while (cursor <= range.ate) {
      buckets.push({ key: format(cursor, 'dd/MM'), date: new Date(cursor), leads: 0, vendas: 0, recusas: 0 })
      cursor = addDays(cursor, 1)
    }
  } else {
    let cursor = startOfWeek(range.de, { weekStartsOn: 1 })
    while (cursor <= range.ate) {
      buckets.push({ key: format(cursor, 'dd/MM'), date: new Date(cursor), leads: 0, vendas: 0, recusas: 0 })
      cursor = addWeeks(cursor, 1)
    }
  }

  function findBucket(dateString) {
    if (!dateString) return -1
    const date = new Date(dateString)
    for (let index = buckets.length - 1; index >= 0; index -= 1) {
      if (date >= buckets[index].date) return index
    }
    return -1
  }

  leads.forEach(lead => {
    if (lead.criadoEm && inRange(lead.criadoEm, range)) {
      const bucket = findBucket(lead.criadoEm)
      if (bucket >= 0) buckets[bucket].leads += 1
    }
    if (lead.coluna === 'recusou') {
      const lastRefusal = (lead.historico || []).slice().reverse().find(item => item.desc.toLowerCase().includes('recus'))
      if (lastRefusal && inRange(lastRefusal.data, range)) {
        const bucket = findBucket(lastRefusal.data)
        if (bucket >= 0) buckets[bucket].recusas += 1
      }
    }
  })

  sales.forEach(sale => {
    if (sale.dataEmissao && inRange(sale.dataEmissao, range)) {
      const bucket = findBucket(sale.dataEmissao)
      if (bucket >= 0) buckets[bucket].vendas += 1
    }
  })

  return buckets
}

function buildOrigins(leads) {
  const counts = ORIGENS.map(origem => ({
    origem,
    total: leads.filter(lead => lead.origem === origem).length,
  })).filter(item => item.total > 0)

  return counts.length > 0
     counts.sort((a, b) => b.total - a.total)
    : [{ origem: 'Sem origem definida', total: leads.filter(lead => !lead.origem).length || 0 }]
}

function buildPipelineOverview(leads) {
  const activeLeads = leads.filter(lead => lead.coluna !== 'recusou')
  const total = activeLeads.length || 1

  return PIPELINE_COLS
    .filter(column => column.id !== 'recusou')
    .map(column => {
      const stageLeads = activeLeads.filter(lead => lead.coluna === column.id)
      const averageAge = stageLeads.length
         Math.round(stageLeads.reduce((sum, lead) => sum + (lead.ultimaAtividade  diffDias(lead.ultimaAtividade) : 0), 0) / stageLeads.length)
        : 0
      const stale = stageLeads.filter(lead => lead.ultimaAtividade && diffDias(lead.ultimaAtividade) >= 7).length
      return {
        ...column,
        total: stageLeads.length,
        ratio: Math.round((stageLeads.length / total) * 100),
        averageAge,
        stale,
      }
    })
}

function buildPriorityItems(leads, events) {
  const todayEvents = (events || [])
    .filter(event => {
      try { return isToday(parseISO(event.data)) } catch { return false }
    })
    .slice(0, 4)
    .map(event => ({
      id: event.id,
      kind: 'evento',
      title: event.nome,
      subtitle: event.tipo || 'Atividade',
      meta: (() => {
        try { return format(parseISO(event.data), "HH:mm 'hoje'") } catch { return 'Hoje' }
      })(),
      accent: '#2563EB',
      leadId: event.leadId || null,
    }))

  const staleLeads = (leads || [])
    .filter(lead => lead.coluna !== 'recusou' && lead.ultimaAtividade && diffDias(lead.ultimaAtividade) >= 5)
    .sort((a, b) => diffDias(b.ultimaAtividade) - diffDias(a.ultimaAtividade))
    .slice(0, 4)
    .map(lead => ({
      id: lead.id,
      kind: 'lead',
      title: lead.nome,
      subtitle: PIPELINE_COLS.find(column => column.id === lead.coluna).label || 'Pipeline',
      meta: `${diffDias(lead.ultimaAtividade)}d sem atividade`,
      accent: diffDias(lead.ultimaAtividade) >= 10  '#EF4444' : '#F59E0B',
      leadId: lead.id,
    }))

  return [...todayEvents, ...staleLeads].slice(0, 8)
}

function buildRanking(sales) {
  return [...(sales || [])]
    .sort((a, b) => (parseFloat(b.valor) || 0) - (parseFloat(a.valor) || 0))
    .slice(0, 5)
    .map(sale => ({
      id: sale.id,
      nome: sale.leadNome || 'Venda manual',
      produto: sale.produto || 'Produto não informado',
      valor: parseFloat(sale.valor) || 0,
    }))
}

function LegendToggle({ hiddenSeries, onToggle }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {Object.entries(SERIES_META).map(([key, meta]) => {
        const hidden = hiddenSeries.has(key)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity ${hidden  'opacity-35' : 'opacity-100'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload.length) return null

  return (
    <div className="rounded-2xl border border-dark-border/60 bg-white/95 px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-dark-text">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map(item => (
          <div key={item.dataKey} className="flex items-center justify-between gap-5 text-xs">
            <span className="inline-flex items-center gap-2 text-dark-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {SERIES_META[item.dataKey].label || item.dataKey}
            </span>
            <span className="font-semibold text-dark-text">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComercialDashboard() {
  const state = useComercial()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [periodo, setPeriodo] = useState({ tipo: 'mes', de: '', ate: '' })
  const [hiddenSeries, setHiddenSeries] = useState(new Set())

  const range = useMemo(() => getPeriodoRange(periodo.tipo, periodo.de, periodo.ate), [periodo])
  const prevRange = useMemo(() => getPrevRange(periodo.tipo, range), [periodo.tipo, range])

  const filteredLeads = useMemo(() => (state.leads || []).filter(lead => inRange(lead.criadoEm, range)), [state.leads, range])
  const prevLeads = useMemo(() => (state.leads || []).filter(lead => inRange(lead.criadoEm, prevRange)), [state.leads, prevRange])
  const filteredSales = useMemo(() => (state.sales || []).filter(sale => inRange(sale.dataEmissao, range)), [state.sales, range])
  const prevSales = useMemo(() => (state.sales || []).filter(sale => inRange(sale.dataEmissao, prevRange)), [state.sales, prevRange])

  const activeLeads = useMemo(
    () => (state.leads || []).filter(lead => !['recusou', 'venda'].includes(lead.coluna)),
    [state.leads]
  )
  const propostas = useMemo(
    () => (state.leads || []).filter(lead => ['oferta', 'negociando', 'followup'].includes(lead.coluna) || lead.propostaEnviada).length,
    [state.leads]
  )
  const conversion = filteredLeads.length  Math.round((filteredSales.length / filteredLeads.length) * 100) : 0
  const prevConversion = prevLeads.length  Math.round((prevSales.length / prevLeads.length) * 100) : 0
  const revenue = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.valor) || 0), 0)
  const ticketMedio = filteredSales.length  revenue / filteredSales.length : 0
  const ranking = useMemo(() => buildRanking(filteredSales), [filteredSales])
  const topRanking = ranking[0]
  const priorityItems = useMemo(() => buildPriorityItems(state.leads || [], state.events || []), [state.leads, state.events])
  const trendData = useMemo(() => buildTrendData(filteredLeads, filteredSales, range), [filteredLeads, filteredSales, range])
  const origins = useMemo(() => buildOrigins(filteredLeads), [filteredLeads])
  const pipelineOverview = useMemo(() => buildPipelineOverview(state.leads || []), [state.leads])
  const todayEventsCount = useMemo(
    () => (state.events || []).filter(event => {
      try { return isToday(parseISO(event.data)) } catch { return false }
    }).length,
    [state.events]
  )

  const periodLabel = format(range.ate, "MMMM 'de' yyyy", { locale: ptBR })
  const displayName = profile.nome.split(' ')[0] || 'time'
  const leadGoals = remainingBusinessDays()

  function toggleSeries(key) {
    setHiddenSeries(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CrmPageHeader
        eyebrow="Central de vendas"
        title={`Operação comercial de ${displayName}`}
        description="Uma leitura única da operação: aquisição, avanço do pipeline, atividades críticas e fechamento. O módulo comercial passa a operar como um CRM dedicado."
        aside={(
          <div className="rounded-[24px] border border-dark-border/60 bg-white/70 px-4 py-3 text-sm shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-muted">Janela ativa</p>
            <p className="mt-1 font-semibold text-dark-text">{periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}</p>
            <p className="mt-1 text-xs text-dark-muted">{leadGoals} dias úteis restantes no mês</p>
          </div>
        )}
        actions={(
          <>
            <button type="button" onClick={() => navigate('/comercial/pipeline')} className="btn-secondary text-sm">
              Ver pipeline
            </button>
            <button type="button" onClick={() => navigate('/comercial/leads')} className="btn-primary text-sm">
              Base de leads
            </button>
          </>
        )}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <CrmSegmentedControl options={PERIOD_OPTIONS} value={periodo.tipo} onChange={value => setPeriodo({ tipo: value, de: '', ate: '' })} />
        {periodo.tipo === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker value={periodo.de} onChange={value => setPeriodo(current => ({ ...current, de: value }))} />
            <span className="text-xs text-dark-muted">até</span>
            <DatePicker value={periodo.ate} onChange={value => setPeriodo(current => ({ ...current, ate: value }))} />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CrmMetricCard
          icon={Users}
          label="Leads ativos"
          value={activeLeads.length}
          accent="#2563EB"
          change={deltaPct(activeLeads.length, prevLeads.filter(lead => !['recusou', 'venda'].includes(lead.coluna)).length)}
          helper="Leads em progresso real"
        />
        <CrmMetricCard
          icon={Activity}
          label="Leads novos"
          value={filteredLeads.length}
          accent="#0F766E"
          change={deltaPct(filteredLeads.length, prevLeads.length)}
          helper="Entradas captadas no período"
        />
        <CrmMetricCard
          icon={FileCheck2}
          label="Propostas"
          value={propostas}
          accent="#7C3AED"
          change={deltaPct(propostas, prevLeads.filter(lead => ['oferta', 'negociando', 'followup'].includes(lead.coluna) || lead.propostaEnviada).length)}
          helper="Leads em oferta, negociação ou follow-up"
        />
        <CrmMetricCard
          icon={BriefcaseBusiness}
          label="Vendas fechadas"
          value={filteredSales.length}
          accent="#059669"
          change={deltaPct(filteredSales.length, prevSales.length)}
          helper="Registros efetivamente convertidos"
        />
        <CrmMetricCard
          icon={Target}
          label="Conversão"
          value={`${conversion}%`}
          accent="#EA580C"
          change={deltaPct(conversion, prevConversion)}
          helper="Vendas sobre leads captados"
        />
        <CrmMetricCard
          icon={CircleDollarSign}
          label="Ticket médio"
          value={formatMoney(ticketMedio)}
          accent="#0F766E"
          change={deltaPct(ticketMedio, prevSales.length  prevSales.reduce((sum, sale) => sum + (parseFloat(sale.valor) || 0), 0) / prevSales.length : 0)}
          helper="Receita média por fechamento"
        />
        <CrmMetricCard
          icon={CalendarClock}
          label="Atividades hoje"
          value={todayEventsCount}
          accent="#2563EB"
          badge={todayEventsCount > 0  'ao vivo' : null}
          helper="Agenda operacional do dia"
        />
        <CrmMetricCard
          icon={TrendingUp}
          label="Ranking comercial"
          value={topRanking  topRanking.nome : 'Sem ranking'}
          accent="#DB2777"
          helper={topRanking  `${formatMoney(topRanking.valor)} em ${topRanking.produto}` : 'Sem vendas no período'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <CrmSectionCard
            title="Analytics comercial"
            subtitle="Visão da cadência de aquisição, conversão e perda."
            action={<LegendToggle hiddenSeries={hiddenSeries} onToggle={toggleSeries} />}
          >
            {trendData.length === 0  (
              <CrmEmptyState
                icon={TrendingUp}
                title="Sem volume no período"
                description="Ajuste a janela temporal ou alimente novos leads e vendas para destravar a leitura analítica."
                compact
              />
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="crmLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="crmSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="crmLoss" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis dataKey="key" tick={{ fontSize: 11, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TrendTooltip />} />
                    <Area type="monotone" dataKey="leads" stroke="#2563EB" strokeWidth={2.4} fill="url(#crmLeads)" dot={false} hide={hiddenSeries.has('leads')} />
                    <Area type="monotone" dataKey="vendas" stroke="#10B981" strokeWidth={2.4} fill="url(#crmSales)" dot={false} hide={hiddenSeries.has('vendas')} />
                    <Area type="monotone" dataKey="recusas" stroke="#EF4444" strokeWidth={2.1} fill="url(#crmLoss)" dot={false} hide={hiddenSeries.has('recusas')} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CrmSectionCard>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <CrmSectionCard title="Origem dos leads" subtitle="Canais que mais alimentam o pipeline atual.">
              {origins.every(item => item.total === 0)  (
                <CrmEmptyState
                  icon={Users}
                  title="Sem origens mapeadas"
                  description="Os leads ainda não possuem origens suficientes para leitura comparativa."
                  compact
                />
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={origins} layout="vertical" margin={{ top: 6, right: 10, left: 12, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="origem" width={110} tick={{ fontSize: 11, fill: 'rgb(15 23 42)' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                      <Bar dataKey="total" radius={[0, 12, 12, 0]}>
                        {origins.map(item => (
                          <Cell key={item.origem} fill={item.origem === 'Seguro Fiança'  '#2563EB' : item.origem === 'Indicação'  '#10B981' : '#7C3AED'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CrmSectionCard>

            <CrmSectionCard title="Ranking comercial" subtitle="Fechamentos com maior impacto financeiro no período.">
              {ranking.length === 0  (
                <CrmEmptyState
                  icon={CircleDollarSign}
                  title="Sem vendas fechadas"
                  description="O ranking aparece automaticamente assim que houver fechamentos no período selecionado."
                  compact
                />
              ) : (
                <div className="space-y-3">
                  {ranking.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate('/comercial/vendas')}
                      className="flex w-full items-center gap-3 rounded-[20px] border border-dark-border/50 bg-white/60 px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-sm font-black text-rose-600">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-dark-text">{item.nome}</p>
                        <p className="truncate text-xs text-dark-muted">{item.produto}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-dark-text">{formatMoney(item.valor)}</p>
                        <p className="text-[11px] text-dark-muted">fechamento</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CrmSectionCard>
          </div>
        </div>

        <div className="space-y-4">
          <CrmSectionCard
            title="Atividades prioritárias"
            subtitle="Agenda, leads parados e pontos de atenção operacional."
            action={(
              <button type="button" onClick={() => navigate('/comercial/calendario')} className="text-xs font-semibold text-brand-accent">
                Abrir calendário
              </button>
            )}
          >
            {priorityItems.length === 0  (
              <CrmEmptyState
                icon={CalendarClock}
                title="Operação limpa"
                description="Nenhum alerta ou atividade crítica no momento."
                compact
              />
            ) : (
              <div className="space-y-3">
                {priorityItems.map(item => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() => item.leadId  navigate(`/comercial/leads/${item.leadId}`) : navigate('/comercial/calendario')}
                    className="flex w-full items-start gap-3 rounded-[22px] border border-dark-border/50 bg-white/65 px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: item.accent }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-dark-text">{item.title}</p>
                      <p className="mt-0.5 text-xs text-dark-muted">{item.subtitle}</p>
                    </div>
                    <span className="rounded-full bg-slate-900/5 px-2 py-1 text-[11px] font-semibold text-dark-muted">
                      {item.meta}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CrmSectionCard>

          <CrmSectionCard title="Resumo executivo" subtitle="Saúde atual da máquina comercial.">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/8 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Receita no período</p>
                <p className="mt-2 text-2xl font-black text-dark-text">{formatMoney(revenue)}</p>
                <p className="mt-1 text-sm text-dark-muted">Distribuída em {filteredSales.length} vendas fechadas.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-dark-border/50 bg-white/55 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-muted">Alertas críticos</p>
                  <p className="mt-2 text-2xl font-black text-dark-text">
                    {(state.leads || []).filter(lead => lead.ultimaAtividade && diffDias(lead.ultimaAtividade) >= 10 && lead.coluna !== 'recusou').length}
                  </p>
                  <p className="mt-1 text-xs text-dark-muted">Leads com mais de 10 dias sem contato.</p>
                </div>
                <div className="rounded-[22px] border border-dark-border/50 bg-white/55 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-muted">Próxima frente</p>
                  <p className="mt-2 text-xl font-black text-dark-text">
                    {pipelineOverview.find(stage => stage.total > 0).label || 'Pipeline vazio'}
                  </p>
                  <p className="mt-1 text-xs text-dark-muted">Maior densidade operacional agora.</p>
                </div>
              </div>
            </div>
          </CrmSectionCard>
        </div>
      </div>

      <CrmSectionCard
        title="Pipeline overview"
        subtitle="Leitura rápida do fluxo comercial atual por etapa, volume e inatividade."
        action={(
          <button type="button" onClick={() => navigate('/comercial/pipeline')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-accent">
            Abrir pipeline <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {pipelineOverview.map(stage => (
            <article key={stage.id} className="rounded-[24px] border border-dark-border/50 bg-white/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: stage.color }} />
                  <p className="text-sm font-semibold text-dark-text">{stage.label}</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: stage.color, background: `${stage.color}16` }}>
                  {stage.ratio}%
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black text-dark-text">{stage.total}</p>
                  <p className="text-xs text-dark-muted">leads na etapa</p>
                </div>
                <div className="h-2 flex-1 rounded-full bg-slate-900/6">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(stage.ratio, stage.total  14 : 0)}%`, background: stage.color }} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[18px] bg-slate-900/[0.035] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Idade média</p>
                  <p className="mt-2 text-lg font-black text-dark-text">{stage.averageAge}d</p>
                </div>
                <div className="rounded-[18px] bg-slate-900/[0.035] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Parados</p>
                  <p className={`mt-2 text-lg font-black ${stage.stale > 0  'text-amber-600' : 'text-dark-text'}`}>{stage.stale}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </CrmSectionCard>
    </div>
  )
}
