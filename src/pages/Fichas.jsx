import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import {
  fetchFichas, fetchFichasParaExportacao, fetchAnosDisponiveis, fetchMesesDisponiveis,
  fetchContagemProdutos, fetchContagemAbertaOrcamentista, deletarFicha,
  fetchKPIsVisaoGeral, fetchDistribuicaoStatus, fetchFichasPorDia,
  fetchRankingFichasMensal, PRODUTO_LABELS, STATUS_LABELS, STATUS_EM_ABERTO, STATUS_PASSADOS,
} from '../lib/fichas'
import { getFichaOperationalState } from '../lib/fichaOperational'
import { normalizeImobiliaria } from '../lib/normalizeImobiliaria'
import { normalizeDisplayText } from '../lib/text'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { Select } from '../components/ui/Select'
import { PageHeader, DataCard, FilterBar, MetricCard } from '../components/ui'
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
import FichaStatusBadge from '../components/FichaStatusBadge'
import { AVATAR_COLORS, BRAND, PRODUTO_COLORS, STATUS_CHART_COLORS as TOKEN_STATUS_CHART_COLORS } from '../design-system/tokens'
import {
  Home, Briefcase, Building, LayoutGrid,
  ChevronRight, Search, Download, Plus,
  FileText, Clock, CheckCircle2, XCircle,
  AlignJustify, Pencil, TrendingUp, TrendingDown, BarChart2, UserSquare2, AlertCircle,
} from 'lucide-react'

// -- Chart theme constants -----------------------------------------------------

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

// -- Constantes ----------------------------------------------------------------

const PRODUTOS = [
  { key: 'residencial_pf',  label: 'Residencial PF', Icon: Home,        accent: BRAND.primary, bg: 'rgba(0,0,121,0.08)',  border: 'rgba(0,0,121,0.25)' },
  { key: 'comercial_pf',    label: 'Comercial PF',   Icon: Briefcase,   accent: PRODUTO_COLORS.comercial_pf.color, bg: 'rgba(34,71,170,0.08)',  border: 'rgba(34,71,170,0.25)' },
  { key: 'pessoa_juridica', label: 'Pessoa Jurídica', Icon: Building,   accent: PRODUTO_COLORS.pessoa_juridica.color, bg: 'rgba(127,190,196,0.10)', border: 'rgba(127,190,196,0.28)' },
  { key: 'todos',           label: 'Todos',           Icon: LayoutGrid, accent: BRAND.accent, bg: 'rgba(220,255,255,0.18)',  border: 'rgba(195,240,242,0.40)' },
]

const MESES_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const FICHA_ROUTE_TO_PRODUTO = {
  '/fichas/residencial': 'residencial_pf',
  '/fichas/comercial-pf': 'comercial_pf',
  '/fichas/pessoa-juridica': 'pessoa_juridica',
  '/fichas/todos': 'todos',
}

const FICHA_PRODUTO_TO_ROUTE = {
  residencial_pf: '/fichas/residencial',
  comercial_pf: '/fichas/comercial-pf',
  pessoa_juridica: '/fichas/pessoa-juridica',
  todos: '/fichas/todos',
}

const SORT_ORDER_OPTIONS = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigas', label: 'Mais antigas' },
]

const PERIODO_FICHAS_OPTIONS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
]

function resolveProdutoFromPathname(pathname) {
  if (pathname === '/fichas') return null
  return FICHA_ROUTE_TO_PRODUTO[pathname] ?? null
}

function resolvePathFromProduto(produto) {
  return FICHA_PRODUTO_TO_ROUTE[produto] ?? '/fichas'
}

function getPeriodoRange(periodo, ano, mes) {
  const now = new Date()

  if (periodo === 'hoje') {
    const inicio = new Date(now)
    inicio.setHours(0, 0, 0, 0)
    return [inicio.toISOString(), now.toISOString()]
  }

  if (periodo === 'semana') {
    const inicio = new Date(now)
    inicio.setDate(inicio.getDate() - 6)
    inicio.setHours(0, 0, 0, 0)
    return [inicio.toISOString(), now.toISOString()]
  }

  const targetYear = ano || now.getFullYear()
  const targetMonth = mes || (now.getMonth() + 1)
  const inicio = new Date(targetYear, targetMonth - 1, 1)
  const fim = new Date(targetYear, targetMonth, 0, 23, 59, 59)
  return [inicio.toISOString(), fim.toISOString()]
}


// -- Helpers -------------------------------------------------------------------

function stringColor(str) {
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(n) { return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?' }

function AvatarOrcamentista({ nome }) {
  if (!nome) return <span className="text-xs text-dark-muted"></span>
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

function formatCSVDate(value, pattern = 'dd/MM/yyyy HH:mm') {
  if (!value) return ''
  try {
    const date = parseISO(value)
    if (Number.isNaN(date.getTime())) return ''
    return format(date, pattern)
  } catch {
    return ''
  }
}

function exportCSV(fichas, filename, resolverNome, mode = 'resumo') {
  const headers = mode === 'completo'
    ? [
        'Data criação', 'Data finalização', 'Imobiliária', 'Nome', 'CPF/CNPJ', 'Produto', 'Status',
        'Status operacional', 'Orçamentista', 'Seguradora', 'Apólice', 'Data emissão', 'Cobrança enviada',
        'Assumida', 'Assumida em', 'Valor aluguel', 'Observações', 'Dados brutos',
      ]
    : ['Data', 'Imobiliária', 'Nome', 'CPF', 'Produto', 'Status', 'Orçamentista', 'Seguradora']

  const rows = fichas.map(f => {
    if (mode === 'completo') {
      const operacional = getFichaOperationalState(f)?.label || ''
      return [
        formatCSVDate(f.created_at),
        formatCSVDate(f.finalizada_em),
        (resolverNome ? resolverNome(f.imobiliaria) : normalizeImobiliaria(f.imobiliaria)) || f.imobiliaria || '',
        f.nome_interessado || f.nome_empresa || '',
        f.cpf || f.cnpj || '',
        PRODUTO_LABELS[f.produto] || f.produto || '',
        STATUS_LABELS[f.status]?.label || f.status || '',
        operacional,
        f.profiles?.nome || '',
        f.seguradora || '',
        f.numero_apolice || '',
        formatCSVDate(f.data_emissao, 'dd/MM/yyyy'),
        f.retorno_enviado ? 'Sim' : 'Não',
        f.assumida ? 'Sim' : 'Não',
        formatCSVDate(f.assumida_em),
        f.valor_aluguel ?? '',
        f.observacoes || '',
        JSON.stringify(f.raw_data || {}),
      ]
    }

    return [
      formatCSVDate(f.created_at, 'dd/MM/yyyy'),
      (resolverNome ? resolverNome(f.imobiliaria) : normalizeImobiliaria(f.imobiliaria)) || f.imobiliaria || '',
      f.nome_interessado || f.nome_empresa || '',
      f.cpf || f.cnpj || '',
      PRODUTO_LABELS[f.produto] || f.produto,
      STATUS_LABELS[f.status]?.label || f.status,
      f.profiles?.nome || '',
      f.seguradora || '',
    ]
  })

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); URL.revokeObjectURL(url)
}

// -- Sub-components ------------------------------------------------------------

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
      <span>Mostrando {from}{to} de {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 0}
                className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">
          ‹ Anterior
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = page < 3 ? i : page - 2 + i
          if (p >= pages) return null
          return (
            <button key={p} onClick={() => onPage(p)}
                    className={`w-7 h-7 rounded-lg text-center transition-colors ${p === page ? 'bg-brand-primary text-white' : 'hover:bg-dark-surface2'}`}>
              {p + 1}
            </button>
          )
        })}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages - 1}
                className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">
          Próximo ›
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
                  view === key ? 'bg-brand-primary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                }`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
          {label}
        </button>
      ))}
    </div>
  )
}

// -- Tooltip para os gráficos --------------------------------------------------

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

// -- Visão Geral ---------------------------------------------------------------

function VisaoGeral({ contagem, onSelectProduto, onCriar, onRelatorio, minhasFichasCount }) {
  const { theme }                  = useTheme()
  const [kpis, setKpis]           = useState(null)
  const [statusDist, setStatusDist] = useState([])
  const [fichasPorDia, setDia]    = useState([])
  const [rankingMensal, setRankingMensal] = useState(null)

  // Filtro de período  padrão = mês/ano atual
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
      fetchRankingFichasMensal(inicioFiltro, fimFiltro),
    ]).then(([k, d, f, r]) => {
      setKpis(k)
      setStatusDist(d)
      setDia(f)
      setRankingMensal(r)
    })
  }, [inicioFiltro, fimFiltro])

  const kpiCards = [
    { label: 'Total do mês', value: kpis?.totalMes ?? '', hint: kpis?.variacaoMes !== undefined && kpis?.variacaoMes !== null ? `${kpis.variacaoMes >= 0 ? '+' : ''}${kpis.variacaoMes}% vs mês anterior` : 'Janela atual', tone: 'accent', icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Hoje', value: kpis?.hoje ?? '', hint: 'Entrada do dia', tone: 'success', icon: <Clock className="w-4 h-4" /> },
    { label: 'Esta semana', value: kpis?.semana ?? '', hint: 'Volume recente', tone: 'secondary', icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Pendentes', value: kpis?.pendentes ?? '', hint: 'Aguardando ação', tone: 'warning', icon: <AlertCircle className="w-4 h-4" /> },
    { label: 'Em cotação', value: kpis?.emCotacao ?? '', hint: 'Já assumidas', tone: 'accent', icon: <FileText className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Mesa operacional"
        title="Fichas"
        description={`Visão geral da operação em ${mesLabel}. Acompanhe volume, status e entrada por produto sem sair da mesa.`}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              <Select
                value={String(filtroMes)}
                onChange={v => setFiltroMes(Number(v))}
                options={MESES_ABBR.map((m, i) => ({ value: String(i + 1), label: m }))}
                className="w-20"
              />
              <Select
                value={String(filtroAno)}
                onChange={v => setFiltroAno(Number(v))}
                options={[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => ({ value: String(y), label: String(y) }))}
                className="w-[74px]"
              />
            </div>
            <Link
              to="/minhas-fichas"
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <UserSquare2 className="w-3.5 h-3.5" />
              Minhas Fichas
              {minhasFichasCount > 0 && (
                <span className="bg-status-warning text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {minhasFichasCount}
                </span>
              )}
            </Link>
            <button
              onClick={onRelatorio}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <BarChart2 className="w-3.5 h-3.5" /> Relatório Mensal
            </button>
            <button onClick={onCriar} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Nova Ficha
            </button>
          </div>
        )}
        stats={(
          <>
            <MetricCard
              label="Total do mês"
              value={kpis?.totalMes ?? ''}
              hint={kpis?.variacaoMes != null ? `${kpis.variacaoMes >= 0 ? '+' : ''}${kpis.variacaoMes}% vs mês anterior` : 'Volume do período'}
              tone="accent"
            />
            <MetricCard
              label="Hoje"
              value={kpis?.hoje ?? ''}
              hint="entrada no dia"
              tone="success"
            />
            <MetricCard
              label="Esta semana"
              value={kpis?.semana ?? ''}
              hint="janela operacional"
              tone="secondary"
            />
            <MetricCard
              label="Pendentes"
              value={kpis?.pendentes ?? ''}
              hint="aguardando ação"
              tone="warning"
            />
            <MetricCard
              label="Em cotação"
              value={kpis?.emCotacao ?? ''}
              hint="carteira ativa"
              tone="accent"
            />
          </>
        )}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <DataCard
          className="xl:col-span-2"
          title="Entrada recente"
          subtitle="Fichas recebidas nos últimos 14 dias"
          bodyClassName="pt-4"
        >
          {fichasPorDia.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={fichasPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.28} />
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
                <Area type="monotone" dataKey="total" name="Total" stroke={BRAND.primary} fill="url(#gradTotal)" strokeWidth={2.2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-dark-muted text-sm">Sem dados para o período</div>
          )}
        </DataCard>

        <DataCard
          title="Mix por status"
          subtitle="Distribuição consolidada no mês selecionado"
          bodyClassName="pt-4"
        >
          {statusDist.length > 0 ? (
            <div className="flex flex-col gap-3">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={TOKEN_STATUS_CHART_COLORS[entry.status] || BRAND.primary} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div style={tooltipStyle(theme)} className="px-2 py-1.5 text-xs">
                      <span style={{ color: TOKEN_STATUS_CHART_COLORS[payload[0]?.payload?.status] || BRAND.primary }}>
                        {payload[0]?.payload?.label}: {payload[0]?.value}
                      </span>
                    </div>
                  ) : null} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {statusDist.slice(0, 4).map(s => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TOKEN_STATUS_CHART_COLORS[s.status] || BRAND.primary }} />
                      <span className="text-dark-muted truncate">{s.label}</span>
                    </div>
                    <span className="font-mono font-semibold text-dark-text">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-dark-muted text-sm">Sem dados para o período</div>
          )}
        </DataCard>
      </div>

      <DataCard
        title="Ranking do mês"
        subtitle="Classificação por usuário com aprovações, recusas e total de fichas passadas no período selecionado."
        bodyClassName="pt-4"
      >
        {rankingMensal === null ? (
          <div className="h-44 flex items-center justify-center text-sm text-dark-muted">Carregando ranking...</div>
        ) : rankingMensal.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-dark-muted">Sem dados para o período</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {rankingMensal.map((item, index) => {
              const initials = (item.name || '')
                .split(' ')
                .filter(Boolean)
                .map(part => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || ''
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border px-4 py-3 transition-colors ${
                    index === 0
                      ? 'border-brand-accent/30 bg-brand-accent/8'
                      : 'border-dark-border/60 bg-dark-surface2/25'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                        index === 0 ? 'shadow-md' : ''
                      }`}
                      style={{ background: index === 0 ? BRAND.accent : stringColor(item.name) }}
                    >
                      {index + 1}
                    </div>
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: stringColor(item.name) }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-dark-text truncate">{item.name}</p>
                        {index === 0 && (
                          <span className="inline-flex items-center rounded-full border border-brand-accent/20 bg-brand-accent/10 px-2 py-0.5 text-[10px] font-semibold text-status-info">
                            Líder do mês
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-dark-muted">
                        {item.approved} aprovadas · {item.refused} recusas · {item.passed} passadas.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-right min-w-[210px]">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">Aprovadas</p>
                        <p className="mt-1 text-base font-semibold text-status-success">{item.approved}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">Recusas</p>
                        <p className="mt-1 text-base font-semibold text-status-danger">{item.refused}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">Passadas</p>
                        <p className="mt-1 text-base font-semibold text-dark-text">{item.passed}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DataCard>

      <DataCard
        title="Selecionar produto"
        subtitle="Abra a mesa operacional por linha de negócio"
        bodyClassName="pt-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PRODUTOS.map((p, i) => {
            const PIcon = p.Icon
            return (
              <button
                key={p.key}
                onClick={() => onSelectProduto(p.key)}
                className="animate-slide-up group text-left rounded-2xl p-5 border transition-all duration-200 active:scale-[0.97] relative overflow-hidden"
                style={{
                  background: p.bg,
                  borderColor: p.border,
                  animationDelay: `${i * 50}ms`,
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
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: p.accent + '20' }}>
                    <PIcon className="w-5 h-5" style={{ color: p.accent }} strokeWidth={1.5} />
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: p.accent + '18', color: p.accent }}
                  >
                    {p.key === 'todos' ? 'Geral' : p.key.includes('pj') || p.key === 'pessoa_juridica' ? 'PJ' : 'PF'}
                  </span>
                </div>

                <p className="font-bold text-base text-dark-text mb-3 leading-tight">{p.label}</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-muted">Total</span>
                    <span className="text-sm font-bold font-mono" style={{ color: p.accent }}>
                      {contagem[p.key]?.total ?? ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-muted">Em aberto</span>
                    <span className="text-sm font-bold font-mono text-status-warning">
                      {contagem[p.key]?.emAberto ?? ''}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </DataCard>
    </div>
  )
}

// -- Seletor de Mês/Ano --------------------------------------------------------

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
                  ? 'bg-brand-primary text-white shadow-sm'
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

function PeriodoSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-dark-border/70 bg-dark-surface2/60 p-1">
      {PERIODO_FICHAS_OPTIONS.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            value === option.value
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// -- Tabelas -------------------------------------------------------------------

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
          const canFin = isMe && ['em_cotacao', 'em_analise'].includes(f.status)
          const rd     = f.raw_data || {}
          const nome   = f.produto === 'pessoa_juridica'
            ? (f.nome_empresa || f.nome_interessado || rd.nome_empresa || rd.razao_social || rd.empresa || rd.nome || '')
            : (f.nome_interessado || rd.nome || '')
          return (
            <tr key={f.id} className="table-row" onClick={() => navigate(`/fichas/${f.id}`)}>
              <td className="td text-dark-muted text-xs whitespace-nowrap font-mono">
                {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
              </td>
              <td className="td font-medium text-dark-text max-w-[150px] truncate">
                {(resolverNome ? resolverNome(f.imobiliaria) : normalizeImobiliaria(f.imobiliaria)) || ''}
              </td>
              <td className="td text-dark-text max-w-[150px] truncate">{nome || ''}</td>
              <td className="td">
                <div className="flex flex-wrap gap-1">
                  <span className={`badge ${si.color}`}>{si.label}</span>
                  <FichaStatusBadge ficha={f} />
                </div>
              </td>
              <td className="td">
                {f.profiles?.nome ? <OrcBadge nome={f.profiles.nome} isMe={isMe} /> : <span className="text-xs text-status-warning font-medium">Livre</span>}
              </td>
              <td className="td"><TimeBadge since={f.created_at} /></td>
              <td className="td whitespace-nowrap" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  {canAss && (
                    <button onClick={() => onAssumir(f.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-brand-secondary/20 text-status-info border border-brand-accent/20 hover:bg-brand-secondary/40 transition-colors font-medium">
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
          const rd2  = f.raw_data || {}
          const nome = f.produto === 'pessoa_juridica'
            ? (normalizeDisplayText(f.nome_empresa || f.nome_interessado || rd2.nome_empresa || rd2.razao_social || rd2.empresa || rd2.nome) || '')
            : (normalizeDisplayText(f.nome_interessado || rd2.nome) || '')
          return (
            <tr key={f.id} className="table-row" onClick={() => navigate(`/fichas/${f.id}`)}>
              <td className="td text-dark-muted text-xs whitespace-nowrap font-mono">
                {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
              </td>
              <td className="td font-medium text-dark-text max-w-[130px] truncate">{(resolverNome ? resolverNome(f.imobiliaria) : normalizeImobiliaria(f.imobiliaria)) || ''}</td>
              <td className="td text-dark-text max-w-[130px] truncate">{nome || ''}</td>
              <td className="td">
                <div className="flex flex-wrap gap-1">
                  <span className={`badge ${si.color}`}>{si.label}</span>
                  <FichaStatusBadge ficha={f} />
                </div>
              </td>
              <td className="td"><AvatarOrcamentista nome={f.profiles?.nome} /></td>
              <td className="td text-dark-muted text-xs">{f.seguradora || ''}</td>
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

// -- PageShell -----------------------------------------------------------------

function PageShell({ prodInfo, mesLabel, anoLabel, onHome, onProduto, onCreate, onRelatorio, viewToggle, selectorSlot, topBar, children }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-5 animate-fade-in">
      <PageHeader
        eyebrow="Mesa operacional"
        title={prodInfo?.label || 'Fichas'}
        description={anoLabel ? `${mesLabel} ${anoLabel} · lista e kanban da linha de negócio selecionada.` : 'Mesa operacional com lista, kanban e drill-down.'}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={onHome}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              Visão geral
            </button>
            {viewToggle}
            <button
              onClick={onRelatorio}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <BarChart2 className="w-3.5 h-3.5" /> Relatório
            </button>
            <button
              onClick={onProduto}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Ver todas
            </button>
            <button onClick={onCreate} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Nova Ficha
            </button>
          </div>
        )}
      />

      {topBar}

      <DataCard
        title="Recorte de trabalho"
        subtitle="Use o período para refinar o lote exibido na mesa operacional"
      >
        {selectorSlot}
      </DataCard>

      <div className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}

// -- Main Component ------------------------------------------------------------

export default function Fichas() {
  const { user }         = useAuth()
  const toast            = useToast()
  const navigate         = useNavigate()
  const location         = useLocation()
  const { resolverNome } = useImobiliaria()

  const agora        = new Date()
  const [produto, setProduto] = useState(() => resolveProdutoFromPathname(location.pathname))
  const [ano,     setAno]     = useState(agora.getFullYear())
  const [mes,     setMes]     = useState(agora.getMonth() + 1)
  const [periodoFiltro, setPeriodoFiltro] = useState('mes')
  const [view,    setView]    = useState(() => {
    try { return localStorage.getItem('fianca-fichas-view') || 'kanban' } catch { return 'kanban' }
  })

  const [contagem,        setContagem]        = useState({})
  const [anos,            setAnos]            = useState([agora.getFullYear()])
  const [mesesComFichas,  setMesesComFichas]  = useState([agora.getMonth() + 1])

  const [tab,            setTab]            = useState('abertas')
  const [kanbanSearch,   setKanbanSearch]   = useState('')
  const [search,         setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [semSeguradora,  setSemSeguradora]  = useState(false)
  const [sortOrderLista, setSortOrderLista] = useState('recentes')
  const [page,           setPage]           = useState(0)
  const [fichas,         setFichas]         = useState([])
  const [total,          setTotal]          = useState(0)
  const [loading,        setLoading]        = useState(false)

  const PAGE_SIZE = 30

  useEffect(() => {
    try { localStorage.setItem('fianca-fichas-view', view) } catch {}
  }, [view])

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
    if (state.view)    setView(state.view)
    let cleanup
    if (state.scrollY) {
      const t = setTimeout(() => window.scrollTo({ top: state.scrollY, behavior: 'instant' }), 150)
      cleanup = () => clearTimeout(t)
    }
    window.history.replaceState({}, document.title)
    return cleanup
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setProduto(resolveProdutoFromPathname(location.pathname))
  }, [location.pathname])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('novo') !== '1') return
    setCriar(true)
    params.delete('novo')
    navigate(
      { pathname: location.pathname, search: params.toString() ? `?${params}` : '' },
      { replace: true },
    )
  }, [location.pathname, location.search, navigate])

  // Contagem de produtos (sempre carregado)
  useEffect(() => {
    fetchContagemProdutos().then(setContagem)
  }, [])

  // Contagem de fichas abertas do usuário logado (badge do botão)
  useEffect(() => {
    if (!user?.id) return
    fetchContagemAbertaOrcamentista(user.id).then(setMinhasFichasCount)
  }, [user?.id])

  // Realtime  atualiza contagens de produto e "minhas fichas" automaticamente (debounce 500ms p/ bursts)
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

  const [dateFrom, dateTo] = useMemo(
    () => getPeriodoRange(periodoFiltro, ano, mes),
    [periodoFiltro, ano, mes]
  )

  // Query de tabela (só usada no modo lista)
  const loadFichas = useCallback(async () => {
    if (!produto) return
    if (view === 'kanban' && produto !== 'todos') return
    setLoading(true)
    const { data, count } = await fetchFichas({
      produto: produto === 'todos' ? undefined : produto,
      ano, mes,
      dateFrom,
      dateTo,
      tipo: tab,
      search: debouncedSearch,
      orcamentistaId: tab === 'passadas_por_mim' ? user?.id : undefined,
      semSeguradora: (tab === 'passadas' || tab === 'passadas_por_mim') ? semSeguradora : false,
      sortOrder: sortOrderLista,
      page, pageSize: PAGE_SIZE,
    })
    setFichas(data)
    setTotal(count)
    setLoading(false)
  }, [produto, ano, mes, dateFrom, dateTo, tab, debouncedSearch, semSeguradora, sortOrderLista, page, user, view])

  useEffect(() => { loadFichas() }, [loadFichas])

  function changeTab(t) { setTab(t); setPage(0); setSearch(''); setDebouncedSearch(''); setSemSeguradora(false) }

  function changeProduto(p) {
    setFichas([]); setTotal(0)
    setView(p === 'todos' ? 'kanban' : view)
    // Reset para mês/ano atual
    setAno(agora.getFullYear())
    setMes(agora.getMonth() + 1)
    setProduto(p)

    if (p === 'todos') {
      navigate('/fichas/todos')
      return
    }

    navigate(resolvePathFromProduto(p))
  }

  function refresh() { loadFichas() }
  function onFichaSuccess() { setCriar(false); setEditar(null); setDetalhe(null); refresh() }

  const isListaFinalizada = tab === 'passadas' || tab === 'passadas_por_mim' || tab === 'canceladas'

  async function handleExportCSV() {
    if (isListaFinalizada) {
      const exportRows = await fetchFichasParaExportacao({
        produto: produto === 'todos' ? undefined : produto,
        ano, mes, dateFrom, dateTo,
        tipo: tab,
        search: debouncedSearch,
        orcamentistaId: tab === 'passadas_por_mim' ? user?.id : undefined,
        semSeguradora: isListaFinalizada ? semSeguradora : false,
        sortOrder: sortOrderLista,
      })
      const sufixo = tab === 'canceladas' ? 'canceladas' : 'passadas'
      exportCSV(exportRows, `conves-fichas-${produto}-${ano}-${mes}-${sufixo}.csv`, resolverNome, 'completo')
      return
    }

    exportCSV(fichas, `conves-fichas-${produto}-${ano}-${mes}.csv`, resolverNome)
  }

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

  // -- View: Visão Geral (sem produto) --
  if (!produto) {
    return (
      <>
        <VisaoGeral
          contagem={contagem}
          onSelectProduto={changeProduto}
          onCriar={() => setCriar(true)}
          onRelatorio={() => setRelatorio(true)}
          minhasFichasCount={minhasFichasCount}
        />
        {criar && (
          <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={() => { setCriar(false); fetchContagemProdutos().then(setContagem) }} />
        )}
        {relatorio && <RelatorioMensal onClose={() => setRelatorio(false)} />}
      </>
    )
  }

  const prodInfo  = PRODUTOS.find(p => p.key === produto)
  const mesLabel  = MESES_ABBR[mes - 1] || ''

  const selectorSlot = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl border border-dark-border/70 bg-dark-surface/70 px-3 py-2 shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Período</span>
        <PeriodoSelector
          value={periodoFiltro}
          onChange={next => { setPeriodoFiltro(next); setPage(0) }}
        />
      </div>
      {periodoFiltro === 'mes' && (
        <FilterBar>
          <MesAnoSelector
            ano={ano}
            anos={anos}
            mes={mes}
            mesesComFichas={mesesComFichas}
            onAnoChange={a => { setAno(a); setPage(0) }}
            onMesChange={m => { setMes(m); setPage(0) }}
          />
        </FilterBar>
      )}
    </div>
  )

  const kanbanSearchBar = (
    <div className={`flex items-center gap-2 bg-dark-surface2 border rounded-2xl px-3 py-2.5 transition-colors ${
      kanbanSearch ? 'border-brand-accent/50' : 'border-dark-border'
    }`}>
      <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
      <input
        type="text"
        placeholder="Buscar por nome, CPF, CNPJ, imobiliária ou seguradora..."
        value={kanbanSearch}
        onChange={e => setKanbanSearch(e.target.value)}
        className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
      />
      {kanbanSearch && (
        <button
          onClick={() => setKanbanSearch('')}
          className="text-dark-muted hover:text-dark-text transition-colors flex-shrink-0 text-xs"
        >✕</button>
      )}
    </div>
  )

  return (
    <PageShell
      prodInfo={prodInfo}
      mesLabel={mesLabel}
      anoLabel={ano}
      onHome={() => { setProduto(null); navigate('/fichas') }}
      onProduto={() => { setProduto('todos'); setView('kanban'); navigate('/fichas/todos') }}
      onCreate={() => setCriar(true)}
      onRelatorio={() => setRelatorio(true)}
      viewToggle={<ViewToggle view={view} onChange={setView} />}
      selectorSlot={selectorSlot}
      topBar={view === 'kanban' ? kanbanSearchBar : null}
    >
      {/* ModalAssumir e ModalFinalizar são overlays  renderizam sobre o board */}
      {assumir && (
        <ModalAssumir id={assumir} onClose={() => setAssumir(null)} onSuccess={() => { setAssumir(null); refresh() }} />
      )}
      {finalizar && (
        <ModalFinalizar ficha={finalizar} onClose={() => setFinalizar(null)} onSuccess={() => { setFinalizar(null); refresh() }} />
      )}

      {/* Conteúdo permanece montado para contextualizar os modais */}
      {view === 'kanban' ? (
        <KanbanFichas
          produto={produto}
          externalDateFrom={dateFrom}
          externalDateTo={dateTo}
          contextState={{ produto, mes, ano }}
          search={kanbanSearch}
        />
      ) : (
        <>
              <FilterBar
            className="mb-4"
            actions={(
              <>
                <div className="flex items-center gap-2 rounded-2xl border border-dark-border/70 bg-dark-surface2/60 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Ordem de envio</span>
                  <div className="flex items-center gap-1 rounded-xl border border-dark-border/70 bg-dark-surface p-0.5">
                    {SORT_ORDER_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => { setSortOrderLista(option.value); setPage(0) }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          sortOrderLista === option.value
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'text-dark-muted hover:text-dark-text'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {isListaFinalizada && (
                  <button
                    onClick={() => { setSemSeguradora(s => !s); setPage(0) }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-medium transition-all ${
                      semSeguradora
                        ? 'border-status-warning bg-status-warning/10 text-status-warning'
                        : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Sem seguradora
                  </button>
                )}
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar
                </button>
              </>
            )}
          >
            <div className="flex items-center gap-1 rounded-2xl border border-dark-border/70 bg-dark-surface2/60 p-1">
              {[
                ['abertas', 'Em Aberto', Clock],
                ['passadas', 'Passadas', CheckCircle2],
                ['canceladas', 'Canceladas', AlertCircle],
                ['passadas_por_mim', 'Passadas por Mim', XCircle],
              ].map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => changeTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    tab === key ? 'bg-brand-primary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[220px] max-w-sm">
              <div className={`flex items-center gap-2 bg-dark-surface2 border rounded-2xl px-3 py-2.5 transition-colors ${
                search ? 'border-brand-accent/50' : 'border-dark-border'
              }`}>
                {search && search !== debouncedSearch ? (
                  <svg className="w-4 h-4 animate-spin text-status-info flex-shrink-0" fill="none" viewBox="0 0 24 24">
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
                <span className="text-[10px] text-status-info/70 pl-1">
                  Buscando em todos os períodos · {total} resultado{total !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {!debouncedSearch && (
              <span className="text-xs text-dark-muted ml-auto">{total} ficha{total !== 1 ? 's' : ''}</span>
            )}
          </FilterBar>

          {tab === 'passadas_por_mim' && fichas.length > 0 && minhaMetrica && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <MetricCard label="Aprovadas" value={minhaMetrica.aprovadas} tone="success" />
              <MetricCard label="Recusadas" value={minhaMetrica.recusadas} tone="warning" />
              <MetricCard label="Emitidas" value={minhaMetrica.emitidas} tone="accent" />
              <MetricCard label="Taxa aprov." value={`${minhaMetrica.taxa}%`} tone="secondary" />
            </div>
          )}

          <DataCard
            title={tab === 'abertas' ? 'Fichas em aberto' : tab === 'canceladas' ? 'Fichas canceladas' : 'Fichas finalizadas'}
            subtitle={debouncedSearch ? `Resultados para "${debouncedSearch}"` : `Total: ${total} ficha${total !== 1 ? 's' : ''}`}
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="p-0 flex min-h-0 flex-1 flex-col"
          >
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
              <div className="flex min-h-0 flex-1 flex-col px-5 pb-4">
                <div className="flex-1 min-h-[420px] overflow-auto rounded-2xl border border-dark-border/60 bg-dark-surface/70">
                  <div className="overflow-x-auto">
                    {tab === 'abertas' ? (
                      <TabelaAberta fichas={fichas} user={user} navigate={navigate} onDetalhe={id => navigate(`/fichas/${id}`)} onAssumir={setAssumir} onFinalizar={setFinalizar} onEditar={setEditar} resolverNome={resolverNome} />
                    ) : (
                      <TabelaPassadas fichas={fichas} user={user} navigate={navigate} onEditar={setEditar} resolverNome={resolverNome} />
                    )}
                  </div>
                </div>
              </div>
            )}
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={p => { setPage(p); window.scrollTo(0,0) }} />
          </DataCard>
        </>
      )}

      {criar && (
        <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={onFichaSuccess} />
      )}
      {editar && (
        <ModalFicha ficha={editar} onClose={() => setEditar(null)} onSuccess={onFichaSuccess} />
      )}
      {relatorio && <RelatorioMensal onClose={() => setRelatorio(false)} />}
    </PageShell>
  )
}

