import { useMemo } from 'react'
import { useComercial, calcScore, scoreFaixa, diffDias, PIPELINE_COLS, PRODUTOS } from '../../lib/comercial'
import { TrendingUp, Users, Target, AlertTriangle, Award, Clock, DollarSign, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, FunnelChart, Funnel, LabelList } from 'recharts'
import { format, parseISO, isToday, addDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color = '#6366F1', alert = false }) {
  return (
    <div className={`card p-4 flex items-start gap-3 ${alert ? 'border border-status-error/30' : ''}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-dark-muted font-medium">{label}</p>
        <p className="text-2xl font-black font-mono text-dark-text leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-dark-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Alert Row ─────────────────────────────────────────────────────────────────

function AlertRow({ lead }) {
  const dias = lead.ultimaAtividade ? diffDias(lead.ultimaAtividade) : 0
  const col  = PIPELINE_COLS.find(c => c.id === lead.coluna)
  return (
    <div className="flex items-center justify-between py-2 border-b border-dark-border/50 last:border-0">
      <div>
        <p className="text-sm font-semibold text-dark-text">{lead.nome}</p>
        {col && <span className="text-[10px]" style={{ color: col.color }}>{col.label}</span>}
      </div>
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${dias >= 14 ? 'bg-status-error/15 text-status-error' : 'bg-status-warning/15 text-status-warning'}`}>
        {dias}d inativo
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ComercialDashboard() {
  const state = useComercial()
  const leads = state.leads
  const sales = state.sales
  const events = state.events

  const stats = useMemo(() => {
    const active = leads.filter(l => l.coluna !== 'recusou')
    const recusou = leads.filter(l => l.coluna === 'recusou')
    const vendas = leads.filter(l => l.coluna === 'venda')
    const txConversao = leads.length > 0 ? Math.round((vendas.length / leads.length) * 100) : 0

    const totalReceita = sales.reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0)
    const totalComissao = sales.reduce((acc, s) => {
      const v = parseFloat(s.valor) || 0
      const c = parseFloat(s.comissao) || 0
      return acc + (v * c / 100)
    }, 0)

    const alertLeads = active.filter(l => l.ultimaAtividade && diffDias(l.ultimaAtividade) >= 7)
      .sort((a, b) => diffDias(b.ultimaAtividade) - diffDias(a.ultimaAtividade))

    const avgScore = active.length > 0 ? Math.round(active.reduce((acc, l) => acc + calcScore(l), 0) / active.length) : 0

    const funnelData = PIPELINE_COLS.filter(c => c.id !== 'followup').map(c => ({
      name: c.label,
      value: leads.filter(l => l.coluna === c.id).length,
      fill: c.color,
    }))

    const distribuicao = PIPELINE_COLS.map(c => ({
      name: c.label.split(' ')[0],
      qtd: leads.filter(l => l.coluna === c.id).length,
      fill: c.color,
    }))

    const todayEvents = events.filter(e => {
      try { return isToday(parseISO(e.data)) } catch { return false }
    })

    return { active: active.length, recusou: recusou.length, vendas: vendas.length, txConversao, totalReceita, totalComissao, alertLeads, avgScore, funnelData, distribuicao, todayEvents }
  }, [leads, sales, events])

  const prodStats = useMemo(() => {
    const map = {}
    sales.forEach(s => {
      const p = PRODUTOS.find(x => x.id === s.produto)
      const label = p ? p.label : s.produto
      map[label] = (map[label] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
  }, [sales])

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-dark-text">Dashboard Comercial</h1>
        <p className="text-xs text-dark-muted mt-0.5">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Users}     label="Leads Ativos"     value={stats.active}    sub={`${stats.recusou} recusaram`}            color="#6366F1" />
        <MetricCard icon={Target}    label="Conversão"        value={`${stats.txConversao}%`} sub={`${stats.vendas} vendas`}         color="#10B981" />
        <MetricCard icon={DollarSign} label="Receita Total"  value={`R$ ${stats.totalReceita.toLocaleString('pt-BR',{minimumFractionDigits:0})}`} sub={`Comissão: R$ ${stats.totalComissao.toFixed(0)}`} color="#F59E0B" />
        <MetricCard icon={Zap}       label="Score Médio"      value={stats.avgScore}  sub={scoreFaixa(stats.avgScore).label}        color={scoreFaixa(stats.avgScore).color} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funil distribuição */}
        <div className="card p-4 lg:col-span-2">
          <p className="text-sm font-semibold text-dark-text mb-4">Distribuição no Funil</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.distribuicao} barSize={20}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--glass-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--glass-text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--glass-bg-heavy)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--glass-text)' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="qtd" radius={[4,4,0,0]}>
                {stats.distribuicao.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Produtos mais vendidos */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-dark-text mb-4">Produtos Vendidos</p>
          {prodStats.length === 0 ? (
            <p className="text-xs text-dark-muted text-center py-8">Sem vendas registradas</p>
          ) : (
            <div className="space-y-2">
              {prodStats.map((p, i) => {
                const pct = Math.round((p.value / sales.length) * 100)
                const colors = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6']
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-dark-muted truncate">{p.name}</span>
                      <span className="text-dark-text font-semibold font-mono">{p.value}</span>
                    </div>
                    <div className="h-1.5 bg-dark-surface2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alertas */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-status-warning" />
            <p className="text-sm font-semibold text-dark-text">Leads sem Atividade</p>
            {stats.alertLeads.length > 0 && (
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning">{stats.alertLeads.length}</span>
            )}
          </div>
          {stats.alertLeads.length === 0 ? (
            <p className="text-xs text-dark-muted text-center py-6">Todos os leads têm atividade recente</p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {stats.alertLeads.slice(0,8).map(l => <AlertRow key={l.id} lead={l} />)}
            </div>
          )}
        </div>

        {/* Agenda de hoje */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-brand-accent" />
            <p className="text-sm font-semibold text-dark-text">Agenda de Hoje</p>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent">{stats.todayEvents.length}</span>
          </div>
          {stats.todayEvents.length === 0 ? (
            <p className="text-xs text-dark-muted text-center py-6">Nenhum evento hoje</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.todayEvents.map(e => {
                const hora = format(parseISO(e.data), 'HH:mm')
                return (
                  <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-dark-border/50 last:border-0">
                    <span className="text-[10px] font-mono text-dark-muted mt-0.5 w-10 flex-shrink-0">{hora}</span>
                    <div>
                      <p className="text-xs font-semibold text-dark-text">{e.nome}</p>
                      {e.descricao && <p className="text-[10px] text-dark-muted">{e.descricao}</p>}
                    </div>
                    <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#6366F120', color: '#6366F1' }}>{e.tipo}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
