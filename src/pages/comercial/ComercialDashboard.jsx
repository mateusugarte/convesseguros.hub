import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useComercial, scoreFaixa, diffDias, PIPELINE_COLS } from '../../lib/comercial'
import { useAuth } from '../../contexts/AuthContext'
import {
  TrendingUp, TrendingDown, Users, Target, FileCheck, Briefcase,
  AlertTriangle, Clock, ChevronRight, Calendar, Activity, ArrowRight,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  format, parseISO,
  startOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  addDays, addWeeks, subMonths, subQuarters, isToday, differenceInDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Period helpers ────────────────────────────────────────────────────────────

const PERIODOS = [
  { id: 'semana',        label: 'Esta semana' },
  { id: 'mes',           label: 'Este mês' },
  { id: 'mes_anterior',  label: 'Último mês' },
  { id: 'trimestre',     label: 'Trimestre' },
  { id: 'personalizado', label: 'Personalizado' },
]

function getPeriodoRange(tipo, de, ate) {
  const now = new Date()
  if (tipo === 'semana')       return { de: startOfWeek(now, { weekStartsOn: 1 }), ate: now }
  if (tipo === 'mes')          return { de: startOfMonth(now), ate: now }
  if (tipo === 'mes_anterior') return { de: startOfMonth(subMonths(now, 1)), ate: endOfMonth(subMonths(now, 1)) }
  if (tipo === 'trimestre')    return { de: startOfQuarter(now), ate: now }
  if (tipo === 'personalizado' && de && ate) return { de: new Date(de), ate: new Date(ate + 'T23:59:59') }
  return { de: startOfMonth(now), ate: now }
}

function getPrevRange(tipo, range) {
  if (!range) return null
  const dur = range.ate.getTime() - range.de.getTime()
  if (tipo === 'mes')          return { de: startOfMonth(subMonths(range.de, 1)), ate: endOfMonth(subMonths(range.de, 1)) }
  if (tipo === 'mes_anterior') return { de: startOfMonth(subMonths(range.de, 1)), ate: endOfMonth(subMonths(range.de, 1)) }
  if (tipo === 'trimestre')    return { de: startOfQuarter(subQuarters(range.de, 1)), ate: endOfQuarter(subQuarters(range.de, 1)) }
  return { de: new Date(range.de.getTime() - dur), ate: new Date(range.ate.getTime() - dur) }
}

function inRange(iso, range) {
  if (!range || !iso) return false
  const d = new Date(iso)
  return d >= range.de && d <= range.ate
}

function deltaPct(cur, prev) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round((cur - prev) / prev * 100)
}

function diasUteisRestantes() {
  const now = new Date()
  const fim = endOfMonth(now)
  let count = 0
  let d = addDays(now, 1)
  while (d <= fim) {
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) count++
    d = addDays(d, 1)
  }
  return count
}

// ── Chart data builder ────────────────────────────────────────────────────────

function buildChartData(leads, sales, range) {
  if (!range) return []
  const { de, ate } = range
  const days  = differenceInDays(ate, de) + 1
  const byDay = days <= 35

  // generate ordered buckets
  const buckets = []
  if (byDay) {
    let d = new Date(de)
    while (d <= ate) {
      buckets.push({ key: format(d, 'dd/MM'), date: new Date(d), leads: 0, vendas: 0, recusados: 0 })
      d = addDays(d, 1)
    }
  } else {
    let d = startOfWeek(de, { weekStartsOn: 1 })
    while (d <= ate) {
      buckets.push({ key: format(d, 'dd/MM'), date: new Date(d), leads: 0, vendas: 0, recusados: 0 })
      d = addWeeks(d, 1)
    }
  }

  function bucketIdx(dateStr) {
    if (!dateStr) return -1
    const d = new Date(dateStr)
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (d >= buckets[i].date) return i
    }
    return -1
  }

  leads.forEach(l => {
    if (l.criadoEm && inRange(l.criadoEm, range)) {
      const i = bucketIdx(l.criadoEm)
      if (i >= 0) buckets[i].leads++
    }
    if (l.coluna === 'recusou') {
      const entry = (l.historico || []).slice().reverse().find(h => h.desc?.toLowerCase().includes('recus'))
      if (entry && inRange(entry.data, range)) {
        const i = bucketIdx(entry.data)
        if (i >= 0) buckets[i].recusados++
      }
    }
  })

  sales.forEach(s => {
    if (s.dataEmissao && inRange(s.dataEmissao, range)) {
      const i = bucketIdx(s.dataEmissao)
      if (i >= 0) buckets[i].vendas++
    }
  })

  return buckets
}

// ── Activity extractor ────────────────────────────────────────────────────────

function extractMovements(leads, range) {
  const items = []
  leads.forEach(lead => {
    const hist = lead.historico || []
    hist.forEach((h, i) => {
      if (!h.desc?.includes('Movido para')) return
      if (!inRange(h.data, range)) return
      const toLabel = h.desc.replace('Movido para ', '')
      const toCol   = PIPELINE_COLS.find(c => c.label === toLabel)
      let fromLabel = 'Contato Feito'
      let fromCol   = PIPELINE_COLS.find(c => c.id === 'contato')
      if (i > 0) {
        const prev = hist[i - 1]
        if (prev.desc.includes('Movido para')) {
          fromLabel = prev.desc.replace('Movido para ', '')
          fromCol   = PIPELINE_COLS.find(c => c.label === fromLabel) || null
        }
      }
      items.push({
        leadId:      lead.id,
        leadNome:    lead.nome,
        imobiliaria: lead.imobiliaria,
        fromLabel,
        fromColor:   fromCol?.color || '#6B7280',
        toLabel,
        toColor:     toCol?.color || '#6B7280',
        data:        h.data,
      })
    })
  })
  return items.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 10)
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-dark-surface2 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 bg-dark-surface2 rounded w-20" />
          <div className="h-6 bg-dark-surface2 rounded w-14" />
          <div className="h-2 bg-dark-surface2 rounded w-24" />
        </div>
      </div>
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-3 bg-dark-surface2 rounded w-32 mb-4" />
      <div className="h-[220px] bg-dark-surface2 rounded-lg" />
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, delta: d, color, estimated = false }) {
  const positive = d > 0
  const neutral  = d === 0 || d === null
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs text-dark-muted font-medium truncate">{label}</p>
          {estimated && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-status-warning/15 text-status-warning font-semibold flex-shrink-0">est.</span>
          )}
        </div>
        <p className="text-2xl font-black font-mono text-dark-text leading-none">{value}</p>
        {d !== null && (
          <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1
            ${positive ? 'text-green-400' : neutral ? 'text-dark-muted' : 'text-status-error'}`}>
            {positive
              ? <TrendingUp   className="w-3 h-3" />
              : !neutral
                ? <TrendingDown className="w-3 h-3" />
                : null}
            {neutral ? '—' : `${positive ? '+' : ''}${d}% vs anterior`}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

const SERIES_META = {
  leads:     { label: 'Leads',     color: '#4A90D9' },
  vendas:    { label: 'Vendas',    color: '#10B981' },
  recusados: { label: 'Recusados', color: '#EF4444' },
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-modal rounded-xl px-3 py-2.5 shadow-xl border border-dark-border text-xs min-w-[120px]">
      <p className="font-semibold text-dark-muted mb-1.5">{label}</p>
      {payload.map(p => {
        const m = SERIES_META[p.dataKey] || {}
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              <span className="text-dark-muted">{m.label}</span>
            </div>
            <span className="font-bold font-mono text-dark-text">{p.value}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────

function PipelineCard({ leads }) {
  const counts   = PIPELINE_COLS.map(c => ({ ...c, count: leads.filter(l => l.coluna === c.id).length }))
  const maxCount = Math.max(...counts.map(c => c.count), 1)
  const total    = leads.length

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm font-semibold text-dark-text">Pipeline Atual</p>
      <div className="space-y-2">
        {counts.map(c => (
          <div key={c.id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-dark-muted truncate max-w-[140px]">{c.label}</span>
              <span className="font-bold font-mono text-dark-text flex-shrink-0 ml-2">{c.count}</span>
            </div>
            <div className="h-1.5 bg-dark-surface2 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(c.count / maxCount) * 100}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-dark-border text-xs">
        <span className="text-dark-muted">Total no funil</span>
        <span className="font-bold text-dark-text font-mono">{total}</span>
      </div>
    </div>
  )
}

// ── Agenda Card ───────────────────────────────────────────────────────────────

function AgendaCard({ events }) {
  const todayEvents = events.filter(e => {
    try { return isToday(parseISO(e.data)) } catch { return false }
  })

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-brand-accent" />
        <p className="text-sm font-semibold text-dark-text">Agenda de Hoje</p>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent">
          {todayEvents.length}
        </span>
      </div>
      {todayEvents.length === 0 ? (
        <p className="text-xs text-dark-muted text-center py-4">Nenhum evento hoje</p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {todayEvents.map(e => {
            let hora = '—'
            try { hora = format(parseISO(e.data), 'HH:mm') } catch {}
            return (
              <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-dark-border/50 last:border-0">
                <span className="text-[10px] font-mono text-dark-muted mt-0.5 w-9 flex-shrink-0">{hora}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-dark-text truncate">{e.nome}</p>
                  {e.descricao && <p className="text-[10px] text-dark-muted truncate">{e.descricao}</p>}
                </div>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent whitespace-nowrap flex-shrink-0">
                  {e.tipo}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Alertas abaixo */}
      <div className="pt-2 border-t border-dark-border">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
          <span className="text-xs font-semibold text-dark-text">Sem atividade ≥ 7 dias</span>
        </div>
        {(() => {
          const alertas = events
            .map(e => e) // placeholder — alertas come from leads, not events
            .slice(0, 0) // see below usage in main
          return alertas.length === 0
            ? <p className="text-[11px] text-dark-muted">Veja abaixo</p>
            : null
        })()}
      </div>
    </div>
  )
}

// ── Activity Table ────────────────────────────────────────────────────────────

function ActivityTable({ items, navigate }) {
  if (items.length === 0) return (
    <div className="card p-6 text-center">
      <Activity className="w-8 h-8 text-dark-muted opacity-30 mx-auto mb-2" />
      <p className="text-sm text-dark-muted">Sem movimentações no período</p>
    </div>
  )

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <p className="text-sm font-semibold text-dark-text">Atividade Recente</p>
        <button onClick={() => navigate('/comercial/leads')}
          className="text-xs text-brand-accent hover:underline flex items-center gap-1">
          Ver todos <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-dark-muted uppercase tracking-wider">Lead</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-dark-muted uppercase tracking-wider hidden sm:table-cell">Imobiliária</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-dark-muted uppercase tracking-wider">Movimento</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-dark-muted uppercase tracking-wider whitespace-nowrap">Data/hora</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              let dataFmt = '—'
              try { dataFmt = format(new Date(item.data), "dd/MM HH:mm") } catch {}
              return (
                <tr key={i} onClick={() => navigate(`/comercial/leads/${item.leadId}`)}
                  className="border-b border-dark-border/50 hover:bg-dark-surface2 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-dark-text text-sm truncate max-w-[140px]">{item.leadNome}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-dark-muted truncate max-w-[120px]">
                    {item.imobiliaria || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{ color: item.fromColor, background: item.fromColor + '22' }}>
                        {item.fromLabel}
                      </span>
                      <ArrowRight className="w-3 h-3 text-dark-muted flex-shrink-0" />
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{ color: item.toColor, background: item.toColor + '22' }}>
                        {item.toLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-dark-muted whitespace-nowrap font-mono">{dataFmt}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ComercialDashboard() {
  const state    = useComercial()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [periodo,       setPeriodo]       = useState({ tipo: 'mes', de: '', ate: '' })
  const [hiddenSeries,  setHiddenSeries]  = useState(new Set())
  const [ready,         setReady]         = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700)
    return () => clearTimeout(t)
  }, [])

  const range     = useMemo(() => getPeriodoRange(periodo.tipo, periodo.de, periodo.ate), [periodo])
  const prevRange = useMemo(() => getPrevRange(periodo.tipo, range), [periodo.tipo, range])

  const filteredLeads = useMemo(
    () => (state.leads || []).filter(l => inRange(l.criadoEm, range)),
    [state.leads, range]
  )
  const prevLeads = useMemo(
    () => (state.leads || []).filter(l => inRange(l.criadoEm, prevRange)),
    [state.leads, prevRange]
  )
  const filteredSales = useMemo(
    () => (state.sales || []).filter(s => inRange(s.dataEmissao, range)),
    [state.sales, range]
  )
  const prevSales = useMemo(
    () => (state.sales || []).filter(s => inRange(s.dataEmissao, prevRange)),
    [state.sales, prevRange]
  )

  // KPIs
  const vendasCount    = filteredLeads.filter(l => l.coluna === 'venda').length
  const fichasProxy    = filteredLeads.filter(l => ['oferta','negociando','venda','followup'].includes(l.coluna)).length
  const txConversao    = filteredLeads.length > 0 ? Math.round(vendasCount / filteredLeads.length * 100) : 0

  const prevVendas     = prevLeads.filter(l => l.coluna === 'venda').length
  const prevFichas     = prevLeads.filter(l => ['oferta','negociando','venda','followup'].includes(l.coluna)).length
  const prevTxConversao = prevLeads.length > 0 ? Math.round(prevVendas / prevLeads.length * 100) : 0

  const chartData     = useMemo(() => buildChartData(filteredLeads, filteredSales, range), [filteredLeads, filteredSales, range])
  const activityItems = useMemo(() => extractMovements(state.leads || [], range), [state.leads, range])

  const alertLeads = useMemo(
    () => (state.leads || [])
      .filter(l => l.coluna !== 'recusou' && l.ultimaAtividade && diffDias(l.ultimaAtividade) >= 7)
      .sort((a, b) => diffDias(b.ultimaAtividade) - diffDias(a.ultimaAtividade))
      .slice(0, 5),
    [state.leads]
  )

  const isLoading = !ready && (state.leads || []).length === 0

  function toggleSeries(key) {
    setHiddenSeries(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }

  // Greeting
  const hora     = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome     = profile?.nome?.split(' ')[0] || ''
  const diasUteis = diasUteisRestantes()
  const mesAno    = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })
  const mesAnoDisplay = mesAno.charAt(0).toUpperCase() + mesAno.slice(1)

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-dark-text">
            {saudacao}{nome ? `, ${nome}` : ''}
          </h1>
          <p className="text-xs text-dark-muted mt-0.5">
            {mesAnoDisplay} · {diasUteis} dia{diasUteis !== 1 ? 's' : ''} útil{diasUteis !== 1 ? 'is' : ''} restante{diasUteis !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Seletor de período */}
        <div className="flex flex-col gap-2 items-start sm:items-end flex-shrink-0">
          <div className="flex bg-dark-surface2 rounded-xl p-0.5 flex-wrap">
            {PERIODOS.filter(p => p.id !== 'personalizado').map(p => (
              <button key={p.id} onClick={() => setPeriodo({ tipo: p.id, de: '', ate: '' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                  ${periodo.tipo === p.id ? 'bg-dark-glass text-dark-text shadow-sm' : 'text-dark-muted hover:text-dark-text'}`}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setPeriodo(prev => ({ ...prev, tipo: 'personalizado' }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1
                ${periodo.tipo === 'personalizado' ? 'bg-dark-glass text-dark-text shadow-sm' : 'text-dark-muted hover:text-dark-text'}`}>
              <Calendar className="w-3 h-3" /> Período
            </button>
          </div>
          {periodo.tipo === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={periodo.de} onChange={e => setPeriodo(p => ({ ...p, de: e.target.value }))}
                className="input text-xs py-1.5 w-32" />
              <span className="text-dark-muted text-xs">até</span>
              <input type="date" value={periodo.ate} onChange={e => setPeriodo(p => ({ ...p, ate: e.target.value }))}
                className="input text-xs py-1.5 w-32" />
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            icon={Users} label="Leads no período"
            value={filteredLeads.length}
            delta={deltaPct(filteredLeads.length, prevLeads.length)}
            color="#4A90D9"
          />
          <KPICard
            icon={FileCheck} label="Fichas geradas"
            value={fichasProxy}
            delta={deltaPct(fichasProxy, prevFichas)}
            color="#8B5CF6"
            estimated
          />
          <KPICard
            icon={Briefcase} label="Apólices emitidas"
            value={filteredSales.length}
            delta={deltaPct(filteredSales.length, prevSales.length)}
            color="#10B981"
          />
          <KPICard
            icon={Target} label="Taxa de conversão"
            value={`${txConversao}%`}
            delta={deltaPct(txConversao, prevTxConversao)}
            color="#F59E0B"
          />
        </div>
      )}

      {/* ── AreaChart ──────────────────────────────────────────────────────── */}
      {isLoading ? <SkeletonChart /> : (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-sm font-semibold text-dark-text">Evolução no Período</p>
            {/* Legend toggles */}
            <div className="flex items-center gap-3">
              {Object.entries(SERIES_META).map(([key, m]) => (
                <button key={key} onClick={() => toggleSeries(key)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${hiddenSeries.has(key) ? 'opacity-40' : ''}`}>
                  <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: m.color }} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-xs text-dark-muted">Sem dados no período</p>
            </div>
          ) : (
            <div style={{ overflow: 'visible' }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4A90D9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4A90D9" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradVendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradRecusados" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                  <XAxis dataKey="key" tick={{ fontSize: 10, fill: 'var(--glass-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--glass-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={<ChartTooltip />}
                    wrapperStyle={{ zIndex: 300, overflow: 'visible' }}
                  />
                  <Area
                    type="monotone" dataKey="leads"
                    stroke="#4A90D9" strokeWidth={2}
                    fill="url(#gradLeads)"
                    dot={false} hide={hiddenSeries.has('leads')}
                  />
                  <Area
                    type="monotone" dataKey="vendas"
                    stroke="#10B981" strokeWidth={2}
                    fill="url(#gradVendas)"
                    dot={false} hide={hiddenSeries.has('vendas')}
                  />
                  <Area
                    type="monotone" dataKey="recusados"
                    stroke="#EF4444" strokeWidth={2}
                    fill="url(#gradRecusados)"
                    dot={false} hide={hiddenSeries.has('recusados')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Grid: Pipeline + Agenda + Alertas ──────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonChart /><SkeletonChart />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PipelineCard leads={state.leads || []} />

          {/* Agenda + Alertas combinados */}
          <div className="card p-4 space-y-4">
            {/* Agenda hoje */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-brand-accent" />
                <p className="text-sm font-semibold text-dark-text">Agenda de Hoje</p>
                {(() => {
                  const count = (state.events || []).filter(e => { try { return isToday(parseISO(e.data)) } catch { return false } }).length
                  return <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent">{count}</span>
                })()}
              </div>
              {(() => {
                const todayEvts = (state.events || []).filter(e => { try { return isToday(parseISO(e.data)) } catch { return false } })
                if (todayEvts.length === 0) return <p className="text-xs text-dark-muted text-center py-3">Nenhum evento hoje</p>
                return (
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                    {todayEvts.map(e => {
                      let hora = '—'
                      try { hora = format(parseISO(e.data), 'HH:mm') } catch {}
                      return (
                        <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-dark-border/50 last:border-0">
                          <span className="text-[10px] font-mono text-dark-muted mt-0.5 w-9 flex-shrink-0">{hora}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-dark-text truncate">{e.nome}</p>
                            {e.descricao && <p className="text-[10px] text-dark-muted truncate">{e.descricao}</p>}
                          </div>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent whitespace-nowrap flex-shrink-0">{e.tipo}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Alertas inatividade */}
            <div className="border-t border-dark-border pt-3">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-status-warning" />
                <p className="text-sm font-semibold text-dark-text">Sem atividade ≥ 7 dias</p>
                {alertLeads.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning">
                    {alertLeads.length}
                  </span>
                )}
              </div>
              {alertLeads.length === 0 ? (
                <p className="text-xs text-dark-muted text-center py-3">Todos com atividade recente</p>
              ) : (
                <div className="space-y-1.5">
                  {alertLeads.map(l => {
                    const dias = diffDias(l.ultimaAtividade)
                    const col  = PIPELINE_COLS.find(c => c.id === l.coluna)
                    return (
                      <div key={l.id} onClick={() => navigate(`/comercial/leads/${l.id}`)}
                        className="flex items-center justify-between py-1.5 border-b border-dark-border/50 last:border-0 cursor-pointer hover:bg-dark-surface2 -mx-1 px-1 rounded transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-dark-text">{l.nome}</p>
                          {col && <span className="text-[10px]" style={{ color: col.color }}>{col.label}</span>}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                          ${dias >= 14 ? 'bg-status-error/15 text-status-error' : 'bg-status-warning/15 text-status-warning'}`}>
                          {dias}d
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabela de atividade recente ─────────────────────────────────────── */}
      {!isLoading && (
        <ActivityTable items={activityItems} navigate={navigate} />
      )}
    </div>
  )
}
