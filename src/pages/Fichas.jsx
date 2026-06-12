import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import {
  fetchFichas, fetchAnosDisponiveis, fetchMesesDisponiveis,
  fetchContagemProdutos, fetchContagemAbertaOrcamentista, deletarFicha,
  fetchKPIsVisaoGeral, fetchDistribuicaoStatus, fetchFichasPorDia,
  PRODUTO_LABELS, STATUS_LABELS, STATUS_EM_ABERTO, STATUS_PASSADOS,
} from '../lib/fichas'
import { normalizeImobiliaria } from '../lib/normalizeImobiliaria'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { Select } from '../components/ui/Select'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import DetalhesFicha from '../components/DetalhesFicha'
import ModalAssumir from '../components/ModalAssumir'
import ModalFinalizar from '../components/ModalFinalizar'
import ModalFicha from '../components/ModalFicha'
import KanbanFichas from '../components/KanbanFichas'
import RelatorioMensal from '../components/RelatorioMensal'
import {
  Home, Briefcase, Building, LayoutGrid,
  ChevronRight, Search, Download, Plus,
  FileText, Clock, CheckCircle2, XCircle,
  AlignJustify, Pencil, TrendingUp, TrendingDown, BarChart2, UserSquare2, AlertCircle,
} from 'lucide-react'

// ── Chart theme constants ─────────────────────────────────────────────────────

const CHART_COLORS = {
  light: {
    grid:    'rgba(8, 20, 50, 0.10)',
    tick:    'rgba(8, 20, 50, 0.55)',
    line1:   '#1d4ed8',
    line2:   '#059669',
    bar:     '#1d4ed8',
    tooltip: {
      background: 'rgba(255,255,255,0.90)',
      border:     'rgba(8,20,50,0.18)',
      color:      'rgba(8,20,50,0.90)',
    },
  },
  dark: {
    grid:    'rgba(180, 210, 255, 0.10)',
    tick:    'rgba(180, 210, 255, 0.55)',
    line1:   '#60a5fa',
    line2:   '#34d399',
    bar:     '#60a5fa',
    tooltip: {
      background: 'rgba(10,30,60,0.92)',
      border:     'rgba(100,160,255,0.22)',
      color:      'rgba(220,235,255,0.92)',
    },
  },
}

const tooltipStyle = (theme) => ({
  background:          CHART_COLORS[theme].tooltip.background,
  backdropFilter:      'blur(16px)',
  WebkitBackdropFilter:'blur(16px)',
  border:              `1px solid ${CHART_COLORS[theme].tooltip.border}`,
  borderRadius:        '12px',
  color:               CHART_COLORS[theme].tooltip.color,
  boxShadow:           '0 8px 32px rgba(0,0,0,0.18)',
})

// ── Constantes ────────────────────────────────────────────────────────────────

const PRODUTOS = [
  { key: 'residencial_pf',  label: 'Residencial PF', Icon: Home,        accent: '#4A90D9', bg: 'rgba(74,144,217,0.08)',  border: 'rgba(74,144,217,0.25)' },
  { key: 'comercial_pf',    label: 'Comercial PF',   Icon: Briefcase,   accent: '#10B981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)' },
  { key: 'pessoa_juridica', label: 'Pessoa Jurídica', Icon: Building,   accent: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
  { key: 'todos',           label: 'Todos',           Icon: LayoutGrid, accent: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
]

const MESES_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const STATUS_CHART_COLORS = {
  aprovado: '#10B981', recusado: '#EF4444', em_cotacao: '#F59E0B',
  pendente: '#3B82F6', emitido: '#2B5BA8', em_analise: '#4A90D9',
  cancelado: '#8899BB', cpf_invalido: '#F59E0B', expirada: '#6B7280',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stringColor(str) {
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) { return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?' }

function AvatarOrcamentista({ nome }) {
  if (!nome) return <span className="text-xs text-dark-muted">—</span>
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
        style={{ background: stringColor(nome) }}
        title={nome}
      >
        {initials(nome)}
      </div>
      <span className="text-xs text-dark-muted truncate max-w-[90px]">{nome}</span>
    </div>
  )
}

function TimeBadge({ since }) {
  const h = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60))
  const [cls, label] = h < 4
    ? ['bg-status-success/15 text-status-success', h < 1 ? '<1h' : `${h}h`]
    : h < 24
    ? ['bg-status-warning/15 text-status-warning', `${h}h`]
    : ['bg-status-danger/15 text-status-danger', `${Math.floor(h/24)}d`]
  return <span className={`badge ${cls} font-mono`}>{label}</span>
}

function OrcBadge({ nome, isMe }) {
  const color = stringColor(nome || '')
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${
      isMe ? 'border-brand-gold/40 text-brand-gold bg-brand-gold/10' : 'border-dark-border text-dark-muted'
    }`}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ background: color }}>{initials(nome)}</span>
      {isMe ? `${nome} (Você)` : nome}
    </span>
  )
}

function exportCSV(fichas, filename, resolverNome) {
  const headers = ['Data','Imobiliária','Nome','CPF','Produto','Status','Orçamentista','Seguradora']
  const rows = fichas.map(f => [
    format(parseISO(f.created_at), 'dd/MM/yyyy'),
    (resolverNome ? resolverNome(f.imobiliaria) : normalizeImobiliaria(f.imobiliaria)) || f.imobiliaria || '',
    f.nome_interessado || f.nome_empresa || '',
    f.cpf || f.cnpj || '',
    PRODUTO_LABELS[f.produto] || f.produto,
    STATUS_LABELS[f.status]?.label || f.status,
    f.profiles?.nome || '',
    f.seguradora || '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Crumb({ onClick, children, active }) {
  return (
    <button onClick={onClick} className={`text-sm transition-colors ${active ? 'text-dark-text font-semibold' : 'text-dark-muted hover:text-dark-text'}`}>
      {children}
    </button>
  )
}

function Pagination({ page, total, pageSize, onPage }) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  const from = page * pageSize + 1, to = Math.min((page + 1) * pageSize, total)
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border text-xs text-dark-muted">
      <span>Mostrando {from}–{to} de {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 0}
                className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">
          ← Anterior
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = page < 3 ? i : page - 2 + i
          if (p >= pages) return null
          return (
            <button key={p} onClick={() => onPage(p)}
                    className={`w-7 h-7 rounded-lg text-center transition-colors ${p === page ? 'bg-brand-secondary text-white' : 'hover:bg-dark-surface2'}`}>
              {p + 1}
            </button>
          )
        })}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages - 1}
                className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">
          Próximo →
        </button>
      </div>
    </div>
  )
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center bg-dark-surface2 border border-dark-border rounded-lg p-0.5 flex-shrink-0">
      {[
        { key: 'kanban', label: 'Kanban', Icon: LayoutGrid },
        { key: 'lista',  label: 'Lista',  Icon: AlignJustify },
      ].map(({ key, label, Icon }) => (
        <button key={key} onClick={() => onChange(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  view === key ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                }`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Tooltip para os gráficos ──────────────────────────────────────────────────

function DarkTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-surface2 border border-dark-border rounded-xl px-3 py-2 shadow-2xl text-xs">
      {label && <p className="text-dark-muted mb-1">
        {(() => { try { return format(parseISO(label), "dd 'de' MMM", { locale: ptBR }) } catch { return label } })()}
      </p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-dark-text font-medium">{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Visão Geral ───────────────────────────────────────────────────────────────

function VisaoGeral({ contagem, onSelectProduto, onCriar, onRelatorio, minhasFichasCount }) {
  const { theme }                  = useTheme()
  const [kpis, setKpis]           = useState(null)
  const [statusDist, setStatusDist] = useState([])
  const [fichasPorDia, setDia]    = useState([])

  // Filtro de período — padrão = mês/ano atual
  const now = new Date()
  const [filtroAno, setFiltroAno] = useState(now.getFullYear())
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1)
  const inicioFiltro = new Date(filtroAno, filtroMes - 1, 1).toISOString()
  const fimFiltro    = new Date(filtroAno, filtroMes, 0, 23, 59, 59).toISOString()

  const mesLabel = new Date(filtroAno, filtroMes - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    Promise.all([
      fetchKPIsVisaoGeral(inicioFiltro, fimFiltro),
      fetchDistribuicaoStatus(inicioFiltro, fimFiltro),
      fetchFichasPorDia(14),
    ]).then(([k, d, f]) => {
      setKpis(k)
      setStatusDist(d)
      setDia(f)
    })
  }, [inicioFiltro, fimFiltro])

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="title-page text-dark-text">Fichas</h1>
          <p className="text-xs text-dark-muted mt-0.5 capitalize">Visão geral · {mesLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Seletor mês/ano para os KPIs */}
          <div className="flex items-center gap-2">
            <Select
              value={String(filtroMes)}
              onChange={v => setFiltroMes(Number(v))}
              options={MESES_ABBR.map((m, i) => ({ value: String(i+1), label: m }))}
              className="w-20"
            />
            <Select
              value={String(filtroAno)}
              onChange={v => setFiltroAno(Number(v))}
              options={[now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y => ({ value: String(y), label: String(y) }))}
              className="w-[74px]"
            />
          </div>
          <Link to="/minhas-fichas"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors">
            <UserSquare2 className="w-3.5 h-3.5" />
            Minhas Fichas
            {minhasFichasCount > 0 && (
              <span className="bg-status-warning text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {minhasFichasCount}
              </span>
            )}
          </Link>
          <button onClick={onRelatorio}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors">
            <BarChart2 className="w-3.5 h-3.5" /> Relatório Mensal
          </button>
          <button onClick={onCriar} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Ficha
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total do mês',  val: kpis?.totalMes,  variacao: kpis?.variacaoMes, accent: '#4A90D9' },
          { label: 'Hoje',          val: kpis?.hoje,       accent: '#10B981' },
          { label: 'Esta semana',   val: kpis?.semana,     accent: '#4A90D9' },
          { label: 'Pendentes',     val: kpis?.pendentes,  accent: '#F59E0B' },
          { label: 'Em Cotação',    val: kpis?.emCotacao,  accent: '#C9A84C' },
        ].map(({ label, val, variacao, accent }) => (
          <div key={label} className="card p-4">
            <p className="eyebrow text-dark-muted mb-2">{label}</p>
            <p className="stat-number" style={{ color: accent }}>{val ?? '—'}</p>
            {variacao !== undefined && variacao !== null && (
              <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${variacao >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                {variacao >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {variacao >= 0 ? '+' : ''}{variacao}% vs mês anterior
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="card p-4 lg:col-span-2">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">Fichas — últimos 14 dias</p>
          {fichasPorDia.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={fichasPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A90D9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4A90D9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: CHART_COLORS[theme].tick }}
                       tickFormatter={v => { try { return format(parseISO(v), 'dd/MM') } catch { return v } }}
                       axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTip />} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#4A90D9" fill="url(#gradTotal)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-dark-muted text-sm">Carregando...</div>
          )}
        </div>

        {/* Donut chart */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">Por Status</p>
          {statusDist.length > 0 ? (
            <div className="flex flex-col gap-2">
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46}>
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={STATUS_CHART_COLORS[entry.status] || '#4A90D9'} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div style={tooltipStyle(theme)} className="px-2 py-1.5 text-xs">
                      <span style={{ color: STATUS_CHART_COLORS[payload[0]?.payload?.status] || '#4A90D9' }}>
                        {payload[0]?.payload?.label}: {payload[0]?.value}
                      </span>
                    </div>
                  ) : null} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1">
                {statusDist.slice(0, 4).map(s => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_CHART_COLORS[s.status] || '#4A90D9' }} />
                      <span className="text-dark-muted truncate max-w-[90px]">{s.label}</span>
                    </div>
                    <span className="font-mono font-semibold text-dark-text">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-dark-muted text-sm">Carregando...</div>
          )}
        </div>
      </div>

      {/* Cards de produto */}
      <div>
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-widest mb-4">Selecione um produto</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUTOS.map((p, i) => {
            const PIcon = p.Icon
            return (
              <button
                key={p.key}
                onClick={() => onSelectProduto(p.key)}
                className="animate-slide-up group text-left rounded-2xl p-5 border transition-all duration-200 active:scale-[0.97] relative overflow-hidden"
                style={{
                  background:   p.bg,
                  borderColor:  p.border,
                  animationDelay:    `${i * 50}ms`,
                  animationFillMode: 'both',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = `0 4px 20px ${p.accent}25, 0 0 0 1px ${p.accent}40`
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = p.accent + '60'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.borderColor = p.border
                }}
              >
                {/* Icon */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: p.accent + '20' }}
                  >
                    <PIcon className="w-5 h-5" style={{ color: p.accent }} strokeWidth={1.5} />
                  </div>
                  {/* Badge de categoria */}
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: p.accent + '18', color: p.accent }}
                  >
                    {p.key === 'todos' ? 'Geral' : p.key.includes('pj') || p.key === 'pessoa_juridica' ? 'PJ' : 'PF'}
                  </span>
                </div>

                {/* Nome do produto em destaque */}
                <p className="font-bold text-base text-dark-text mb-3 leading-tight">{p.label}</p>

                {/* Métricas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-muted">Total</span>
                    <span className="text-sm font-bold font-mono" style={{ color: p.accent }}>
                      {contagem[p.key]?.total ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-muted">Em Aberto</span>
                    <span className="text-sm font-bold font-mono text-status-warning">
                      {contagem[p.key]?.emAberto ?? '—'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Seletor de Mês/Ano ────────────────────────────────────────────────────────

function MesAnoSelector({ ano, anos, mes, mesesComFichas, onAnoChange, onMesChange }) {
  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Dropdown de ano */}
      <Select
        value={String(ano)}
        onChange={v => onAnoChange(Number(v))}
        options={anos.map(a => ({ value: String(a), label: String(a) }))}
        className="w-24"
      />

      {/* Pills de mês */}
      <div className="flex items-center gap-1 flex-wrap">
        {MESES_ABBR.map((label, i) => {
          const monthNum   = i + 1
          const hasData    = mesesComFichas.includes(monthNum)
          const isActive   = mes === monthNum
          const isCurrMes  = monthNum === currentMonth && ano === currentYear

          return (
            <button
              key={monthNum}
              onClick={() => onMesChange(monthNum)}
              disabled={!hasData && !isActive}
              title={!hasData ? 'Sem fichas neste mês' : MESES_FULL[i]}
              className={`relative px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-brand-secondary text-white shadow-sm'
                  : hasData
                  ? 'text-dark-text hover:bg-dark-surface2'
                  : 'text-dark-muted/35 cursor-not-allowed'
              }`}
            >
              {label}
              {/* Ponto indicador do mês atual */}
              {isCurrMes && !isActive && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-accent" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Tabelas ───────────────────────────────────────────────────────────────────

function TabelaAberta({ fichas, user, navigate, onDetalhe, onAssumir, onFinalizar, onEditar, resolverNome }) {
  return (
    <table className="table-table w-full text-sm">
      <thead className="table-thead border-b border-dark-border">
        <tr>
          {['Data','Imobiliária','Nome','Status','Orçamentista','Tempo',''].map(h => (
            <th key={h} className="th whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-dark-border">
        {fichas.map(f => {
          const si     = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
          const isMe   = f.orcamentista_id === user?.id
          const canAss = !f.assumida && f.status === 'pendente'
          const canFin = isMe && f.status === 'em_cotacao'
          const nome   = f.produto === 'pessoa_juridica' ? (f.nome_empresa || f.nome_interessado) : f.nome_interessado
          return (
            <tr key={f.id} className="table-row" onClick={() => navigate(`/fichas/${f.id}`)}>
              <td className="td text-dark-muted text-xs whitespace-nowrap font-mono">
                {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
              </td>
              <td className="td font-medium text-dark-text max-w-[150px] truncate">
                {(resolverNome ? resolverNome(f.imobiliaria) : normalizeImobiliaria(f.imobiliaria)) || '—'}
              </td>
              <td className="td text-dark-text max-w-[150px] truncate">{nome || '—'}</td>
              <td className="td"><span className={`badge ${si.color}`}>{si.label}</span></td>
              <td className="td">
                {f.profiles?.nome ? <OrcBadge nome={f.profiles.nome} isMe={isMe} /> : <span className="text-xs text-status-warning font-medium">Livre</span>}
              </td>
              <td className="td"><TimeBadge since={f.created_at} /></td>
              <td className="td whitespace-nowrap" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  {canAss && (
                    <button onClick={() => onAssumir(f.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-brand-secondary/20 text-brand-accent border border-brand-accent/20 hover:bg-brand-secondary/40 transition-colors font-medium">
                      Assumir
                    </button>
                  )}
                  {canFin && (
                    <button onClick={() => onFinalizar(f)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors font-medium">
                      Finalizar
                    </button>
                  )}
                  <button onClick={() => onEditar(f)}
                          className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function TabelaPassadas({ fichas, user, navigate, onEditar, resolverNome }) {
  return (
    <table className="table-table w-full text-sm">
      <thead className="table-thead border-b border-dark-border">
        <tr>
          {['Data','Imobiliária','Nome','Status','Orçamentista','Seguradora',''].map(h => (
            <th key={h} className="th whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-dark-border">
        {fichas.map(f => {
          const si   = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
          const isMe = f.orcamentista_id === user?.id
          const nome = f.produto === 'pessoa_juridica' ? (f.nome_empresa || f.nome_interessado) : f.nome_interessado
          return (
            <tr key={f.id} className="table-row" onClick={() => navigate(`/fichas/${f.id}`)}>
              <td className="td text-dark-muted text-xs whitespace-nowrap font-mono">
                {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
              </td>
              <td className="td font-medium text-dark-text max-w-[130px] truncate">{(resolverNome ? resolverNome(f.imobiliaria) : normalizeImobiliaria(f.imobiliaria)) || '—'}</td>
              <td className="td text-dark-text max-w-[130px] truncate">{nome || '—'}</td>
              <td className="td"><span className={`badge ${si.color}`}>{si.label}</span></td>
              <td className="td"><AvatarOrcamentista nome={f.profiles?.nome} /></td>
              <td className="td text-dark-muted text-xs">{f.seguradora || '—'}</td>
              <td className="td" onClick={e => e.stopPropagation()}>
                <button onClick={() => onEditar(f)} className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── PageShell ─────────────────────────────────────────────────────────────────

function PageShell({ prodInfo, mesLabel, anoLabel, onHome, onProduto, onCreate, onRelatorio, viewToggle, selectorSlot, children }) {
  const PIcon = prodInfo?.Icon
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header: breadcrumb + ações */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <button onClick={onHome} className="text-dark-muted hover:text-dark-text transition-colors">
            <Home className="w-4 h-4" />
          </button>
          <ChevronRight className="w-3 h-3 text-dark-border" />
          <Crumb onClick={onProduto} active={false}>
            {PIcon && <PIcon className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" style={{ color: prodInfo?.accent }} strokeWidth={1.5} />}
            {prodInfo?.label}
          </Crumb>
          {anoLabel && <>
            <ChevronRight className="w-3 h-3 text-dark-border" />
            <Crumb active>{mesLabel} {anoLabel}</Crumb>
          </>}
        </div>
        <div className="flex items-center gap-2">
          {viewToggle}
          <button onClick={onRelatorio}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors">
            <BarChart2 className="w-3.5 h-3.5" /> Relatório
          </button>
          <button onClick={onCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Ficha
          </button>
        </div>
      </div>

      {/* Seletor de mês/ano */}
      {selectorSlot}

      {children}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Fichas() {
  const { user }         = useAuth()
  const toast            = useToast()
  const navigate         = useNavigate()
  const location         = useLocation()
  const { resolverNome } = useImobiliaria()

  const agora        = new Date()
  const [produto, setProduto] = useState(null)
  const [ano,     setAno]     = useState(agora.getFullYear())
  const [mes,     setMes]     = useState(agora.getMonth() + 1)
  const [view,    setView]    = useState('kanban')

  const [contagem,        setContagem]        = useState({})
  const [anos,            setAnos]            = useState([agora.getFullYear()])
  const [mesesComFichas,  setMesesComFichas]  = useState([agora.getMonth() + 1])

  const [tab,            setTab]            = useState('abertas')
  const [search,         setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [semSeguradora,  setSemSeguradora]  = useState(false)
  const [page,           setPage]           = useState(0)
  const [fichas,         setFichas]         = useState([])
  const [total,          setTotal]          = useState(0)
  const [loading,        setLoading]        = useState(false)

  const PAGE_SIZE = 30

  // Debounce: dispara query 400ms após o usuário parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const [detalhe,          setDetalhe]          = useState(null)
  const [assumir,          setAssumir]          = useState(null)
  const [finalizar,        setFinalizar]        = useState(null)
  const [criar,            setCriar]            = useState(false)
  const [editar,           setEditar]           = useState(null)
  const [relatorio,        setRelatorio]        = useState(false)
  const [minhasFichasCount, setMinhasFichasCount] = useState(0)

  // Restaurar Kanban ao voltar de /fichas/:id
  useEffect(() => {
    const state = location.state
    if (!state?.restoreKanban) return
    if (state.produto) setProduto(state.produto)
    if (state.mes)     setMes(state.mes)
    if (state.ano)     setAno(state.ano)
    let cleanup
    if (state.scrollY) {
      const t = setTimeout(() => window.scrollTo({ top: state.scrollY, behavior: 'instant' }), 150)
      cleanup = () => clearTimeout(t)
    }
    window.history.replaceState({}, document.title)
    return cleanup
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Contagem de produtos (sempre carregado)
  useEffect(() => {
    fetchContagemProdutos().then(setContagem)
  }, [])

  // Contagem de fichas abertas do usuário logado (badge do botão)
  useEffect(() => {
    if (!user?.id) return
    fetchContagemAbertaOrcamentista(user.id).then(setMinhasFichasCount)
  }, [user?.id])

  // Realtime — atualiza contagens de produto e "minhas fichas" automaticamente (debounce 500ms p/ bursts)
  useEffect(() => {
    let timer
    const debouncedRefresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        fetchContagemProdutos().then(setContagem)
        if (user?.id) fetchContagemAbertaOrcamentista(user.id).then(setMinhasFichasCount)
      }, 500)
    }
    const ch = supabase.channel('fichas-page-contagem')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fichas' }, debouncedRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fichas' }, debouncedRefresh)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
      clearTimeout(timer)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ao selecionar produto: carregar anos disponíveis e auto-selecionar o atual
  useEffect(() => {
    if (!produto) return
    fetchAnosDisponiveis(produto).then(years => {
      if (years.length === 0) return
      setAnos(years)
      const currentYear = agora.getFullYear()
      const targetYear  = years.includes(currentYear) ? currentYear : years[0]
      setAno(targetYear)
    })
  }, [produto])

  // Ao mudar produto ou ano: carregar quais meses têm fichas
  useEffect(() => {
    if (!produto) return
    fetchMesesDisponiveis(produto, ano).then(setMesesComFichas)
  }, [produto, ano])

  // Datas calculadas do mês/ano selecionados
  const dateFrom = ano && mes ? new Date(ano, mes - 1, 1).toISOString() : null
  const dateTo   = ano && mes ? new Date(ano, mes, 0, 23, 59, 59).toISOString() : null

  // Query de tabela (só usada no modo lista)
  const loadFichas = useCallback(async () => {
    if (!produto) return
    if (view === 'kanban' && produto !== 'todos') return
    setLoading(true)
    const { data, count } = await fetchFichas({
      produto: produto === 'todos' ? undefined : produto,
      ano, mes,
      tipo: tab,
      search: debouncedSearch,
      orcamentistaId: tab === 'passadas_por_mim' ? user?.id : undefined,
      semSeguradora: (tab === 'passadas' || tab === 'passadas_por_mim') ? semSeguradora : false,
      page, pageSize: PAGE_SIZE,
    })
    setFichas(data)
    setTotal(count)
    setLoading(false)
  }, [produto, ano, mes, tab, debouncedSearch, semSeguradora, page, user, view])

  useEffect(() => { loadFichas() }, [loadFichas])

  function changeTab(t) { setTab(t); setPage(0); setSearch(''); setDebouncedSearch(''); setSemSeguradora(false) }

  function changeProduto(p) {
    setProduto(p)
    setFichas([]); setTotal(0)
    setView(p === 'todos' ? 'lista' : 'kanban')
    // Reset para mês/ano atual
    setAno(agora.getFullYear())
    setMes(agora.getMonth() + 1)
  }

  function refresh() { loadFichas() }
  function onFichaSuccess() { setCriar(false); setEditar(null); setDetalhe(null); refresh() }

  async function onDelete(id) {
    await deletarFicha(id)
    setDetalhe(null)
    toast({ type: 'success', title: 'Ficha excluída' })
    refresh()
  }

  const minhaMetrica = useMemo(() => {
    if (tab !== 'passadas_por_mim') return null
    const aprovadas = fichas.filter(f => f.status === 'aprovado').length
    const recusadas = fichas.filter(f => f.status === 'recusado').length
    const emitidas  = fichas.filter(f => f.status === 'emitido').length
    const taxa      = fichas.length > 0 ? Math.round((aprovadas / fichas.length) * 100) : 0
    return { aprovadas, recusadas, emitidas, taxa }
  }, [tab, fichas])

  // ── View: Visão Geral (sem produto) ──
  if (!produto) {
    if (criar) return (
      <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={() => { setCriar(false); fetchContagemProdutos().then(setContagem) }} />
    )
    return (
      <>
        <VisaoGeral
          contagem={contagem}
          onSelectProduto={changeProduto}
          onCriar={() => setCriar(true)}
          onRelatorio={() => setRelatorio(true)}
          minhasFichasCount={minhasFichasCount}
        />
        {relatorio && <RelatorioMensal onClose={() => setRelatorio(false)} />}
      </>
    )
  }

  const prodInfo  = PRODUTOS.find(p => p.key === produto)
  const mesLabel  = MESES_ABBR[mes - 1] || ''

  const selectorSlot = (
    <div className="card px-4 py-3">
      <MesAnoSelector
        ano={ano}
        anos={anos}
        mes={mes}
        mesesComFichas={mesesComFichas}
        onAnoChange={a => { setAno(a); setPage(0) }}
        onMesChange={m => { setMes(m); setPage(0) }}
      />
    </div>
  )

  return (
    <PageShell
      prodInfo={prodInfo}
      mesLabel={mesLabel}
      anoLabel={ano}
      onHome={() => setProduto(null)}
      onProduto={() => setProduto(null)}
      onCreate={() => setCriar(true)}
      onRelatorio={() => setRelatorio(true)}
      viewToggle={<ViewToggle view={view} onChange={setView} />}
      selectorSlot={selectorSlot}
    >
      {/* ModalAssumir e ModalFinalizar são overlays — renderizam sobre o board */}
      {assumir && (
        <ModalAssumir id={assumir} onClose={() => setAssumir(null)} onSuccess={() => { setAssumir(null); refresh() }} />
      )}
      {finalizar && (
        <ModalFinalizar ficha={finalizar} onClose={() => setFinalizar(null)} onSuccess={() => { setFinalizar(null); refresh() }} />
      )}

      {/* Page-replacing areas for create/edit */}
      {criar ? (
        <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={onFichaSuccess} />
      ) : editar ? (
        <ModalFicha ficha={editar} onClose={() => setEditar(null)} onSuccess={onFichaSuccess} />
      ) : view === 'kanban' ? (
        <KanbanFichas
          produto={produto}
          externalDateFrom={dateFrom}
          externalDateTo={dateTo}
          contextState={{ produto, mes, ano }}
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-dark-border mb-5">
            {[
              ['abertas',          'Em Aberto',       <Clock className="w-3.5 h-3.5" />],
              ['passadas',         'Passadas',         <CheckCircle2 className="w-3.5 h-3.5" />],
              ['passadas_por_mim', 'Passadas por Mim', <XCircle className="w-3.5 h-3.5" />],
            ].map(([key, label, icon]) => (
              <button key={key} onClick={() => changeTab(key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                        tab === key ? 'border-brand-accent text-brand-accent' : 'border-transparent text-dark-muted hover:text-dark-text'
                      }`}>
                {icon}{label}
              </button>
            ))}
          </div>

          {tab === 'passadas_por_mim' && fichas.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                ['Aprovadas', minhaMetrica.aprovadas, 'text-status-success'],
                ['Recusadas', minhaMetrica.recusadas, 'text-status-danger'],
                ['Emitidas',  minhaMetrica.emitidas,  'text-brand-accent'],
                [`Taxa Aprov.`, `${minhaMetrica.taxa}%`, 'text-status-success'],
              ].map(([l, v, cls]) => (
                <div key={l} className="card p-3 text-center">
                  <p className="text-xs text-dark-muted mb-1">{l}</p>
                  <p className={`text-xl font-bold font-mono ${cls}`}>{v}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-sm">
              <div className={`flex items-center gap-2 bg-dark-surface2 border rounded-lg px-3 py-2 transition-colors ${
                search ? 'border-brand-accent/50' : 'border-dark-border'
              }`}>
                {search && search !== debouncedSearch ? (
                  <svg className="w-4 h-4 animate-spin text-brand-accent flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
                )}
                <input
                  type="text"
                  placeholder="Nome, CPF, CNPJ, imobiliária ou seguradora..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                  className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(0) }}
                    className="text-dark-muted hover:text-dark-text transition-colors flex-shrink-0 text-xs"
                  >✕</button>
                )}
              </div>
              {debouncedSearch && (
                <span className="text-[10px] text-brand-accent/70 pl-1">
                  Buscando em todos os períodos · {total} resultado{total !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {(tab === 'passadas' || tab === 'passadas_por_mim') && (
              <button
                onClick={() => { setSemSeguradora(s => !s); setPage(0) }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  semSeguradora
                    ? 'border-status-warning bg-status-warning/10 text-status-warning'
                    : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Sem seguradora
              </button>
            )}
            {!debouncedSearch && <span className="text-xs text-dark-muted ml-auto">{total} ficha{total !== 1 ? 's' : ''}</span>}
            <button
              onClick={() => exportCSV(fichas, `conves-fichas-${produto}-${ano}-${mes}.csv`, resolverNome)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Carregando...
              </div>
            ) : fichas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-dark-muted">
                <FileText className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhuma ficha encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {tab === 'abertas' ? (
                  <TabelaAberta fichas={fichas} user={user} navigate={navigate} onDetalhe={id => navigate(`/fichas/${id}`)} onAssumir={setAssumir} onFinalizar={setFinalizar} onEditar={setEditar} resolverNome={resolverNome} />
                ) : (
                  <TabelaPassadas fichas={fichas} user={user} navigate={navigate} onEditar={setEditar} resolverNome={resolverNome} />
                )}
              </div>
            )}
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={p => { setPage(p); window.scrollTo(0,0) }} />
          </div>
        </>
      )}

      {relatorio && <RelatorioMensal onClose={() => setRelatorio(false)} />}
    </PageShell>
  )
}
