import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  BarChart2,
  CheckSquare,
  LayoutGrid,
  MoveRight,
  Search,
  Square,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  FileText,
  ExternalLink,
  AlertTriangle,
  BellRing,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { editarFicha } from '../lib/fichas'
import { registrarApoliceDaFicha, formatMoneyBR, toNumber } from '../lib/apolices'
import {
  buildAprovadaPatch,
  buildCobrancaPatch,
  buildImobiliariaRetornoPatch,
  buildCobrancaHistoricoPatch,
  isCobrancaEnviadaVisivel,
  getCobrancaEnviadaDisplay,
  getImobiliariaRetornouDisplay,
} from '../lib/relatorioCobranca'
import { fetchSeguradorasPorProduto } from '../lib/seguradoras'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { PageHeader, MetricCard, DataCard, Select, Avatar, Modal } from '../components/ui'
import SeguradoraBadge from '../components/SeguradoraBadge'
import ImobiliariaIdentity from '../components/ImobiliariaIdentity'
import { normalizeDisplayText } from '../lib/text'
import { getEntityImageUrl } from '../lib/entityMedia'
import { getFichaOperationalState } from '../lib/fichaOperational'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const PERIOD_OPTIONS = [
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
  { value: 'historico', label: 'Histórico' },
]

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const COLUNAS = [
  { id: 'aprovada', label: 'Aprovadas', color: '#0f766e', copyStatus: 'Aprovada' },
  { id: 'emitida', label: 'Emitidas', color: '#000079', copyStatus: 'Emitida' },
  { id: 'enviado_cobranca', label: 'Enviado Cobrança', color: '#2247aa', copyStatus: 'Enviado Cobrança' },
  { id: 'recuperados', label: 'RECUPERADOS', color: '#4b6cc2', copyStatus: 'Recuperada' },
  { id: 'expirada', label: 'Expiradas', color: '#6B7280', copyStatus: 'Expirada' },
]

const REPORT_STATUSES = ['aprovado', 'emitido']
const COBRANCA_TOGGLE_STORAGE = 'relatorio-cobranca-toggle'
const RELATORIO_FINALIZADO_STORAGE = 'relatorio-finalizado-v1'
const MANUAL_REPORT_MOVE_OPTIONS = COLUNAS.filter(col => ['aprovada', 'enviado_cobranca'].includes(col.id))

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toLocalYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getMonthRange(ano, mes) {
  return [toLocalYmd(new Date(ano, mes - 1, 1)), toLocalYmd(new Date(ano, mes, 0, 23, 59, 59))]
}

function getYearRange(ano) {
  return [toLocalYmd(new Date(ano, 0, 1)), toLocalYmd(new Date(ano, 11, 31, 23, 59, 59))]
}

function formatDateBR(value) {
  if (!value) return '—'
  try {
    return format(parseISO(String(value)), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return String(value).slice(0, 10)
  }
}

function normalizeKey(value) {
  return normalizeDisplayText(String(value || '')).toLowerCase().trim()
}

async function fetchAllRows(queryFactory, pageSize = 1000) {
  let all = []
  let offset = 0

  while (true) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  return all
}

function getPeriodoLabel(periodo, ano, mes) {
  if (periodo === 'historico') return 'Histórico'
  if (periodo === 'ano') return String(ano)
  return `${MESES_FULL[mes - 1]} ${ano}`
}

function getReportRange(periodo, ano, mes) {
  if (periodo === 'historico') return [null, null]
  if (periodo === 'ano') return getYearRange(ano)
  return getMonthRange(ano, mes)
}

function getOperacionalStatus(ficha) {
  const meta = getFichaOperationalState(ficha)
  return meta ? { id: meta.id, label: meta.label, color: meta.className } : null
}

function getColuna(ficha) {
  const op = getOperacionalStatus(ficha)
  return op?.id || null
}

function getNomeFicha(ficha) {
  if (!ficha) return '—'
  if (ficha.produto === 'pessoa_juridica') {
    return normalizeDisplayText(ficha.nome_empresa || ficha.nome_interessado) || '—'
  }
  return normalizeDisplayText(ficha.nome_interessado) || '—'
}

function getDocumento(ficha) {
  const digits = String(ficha?.produto === 'pessoa_juridica' ? ficha?.cnpj : ficha?.cpf || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 14) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
  if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  return String(ficha?.produto === 'pessoa_juridica' ? ficha?.cnpj : ficha?.cpf || '')
}

function getRecoveryStart(ficha) {
  return ficha?.raw_data?.cobranca_started_at || null
}


function isRecovered(ficha) {
  return Boolean(ficha?.raw_data?.recovered_after_cobranca)
}

function isInCobranca(ficha) {
  return getColuna(ficha) === 'enviado_cobranca'
}

function isApprovedFicha(ficha) {
  const coluna = getColuna(ficha)
  return coluna === 'aprovada' || coluna === 'enviado_cobranca'
}

function isSemCobrancaEnviada(ficha) {
  return getColuna(ficha) === 'aprovada'
}

function isAguardandoRetorno(ficha) {
  return getColuna(ficha) === 'enviado_cobranca' && !getImobiliariaRetornouDisplay(ficha)
}

function isEmitida(ficha) {
  return Boolean(ficha?._hasEmittedPolicy)
}

function getEffectiveSeguradora(ficha) {
  return ficha?._effectiveSeguradora || ficha?.seguradora || null
}

function getEffectiveNumeroApolice(ficha) {
  return ficha?._effectiveNumeroApolice || ficha?.numero_apolice || null
}

function getEffectiveDataEmissao(ficha) {
  return ficha?._effectiveDataEmissao || ficha?.data_emissao || null
}

function getCanonicalImobiliariaNome(ficha) {
  return ficha?._imobiliariaNome || '—'
}

function isEligibleReportRow(ficha) {
  return Boolean(getColuna(ficha))
}

function buildCopyLines(fichas, coluna) {
  const status = COLUNAS.find(c => c.id === coluna)?.copyStatus || coluna
  return fichas
    .map(f => {
      const nome = getNomeFicha(f)
      const imob = getCanonicalImobiliariaNome(f)
      const data = formatDateBR(f.created_at)
      const cep = f.cep || '—'
      return `${nome} - ${imob} - ${data} - Status (${status}) - ${cep}`
    })
    .join('\n')
}

function formatCurrencyValue(value) {
  const n = toNumber(value)
  if (n === null) return null
  return formatMoneyBR(n)
}

function getPeriodoScopeKey(periodo, ano, mes) {
  if (periodo === 'historico') return 'historico'
  if (periodo === 'ano') return `ano:${ano}`
  return `mes:${ano}:${mes}`
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
function summarizeRows(rows, emittedPolicies = []) {
  const summary = {
    total: rows.length,
    aprovadas: 0,
    semCobrancaEnviada: 0,
    aguardandoRetorno: 0,
    emitidas: emittedPolicies.length,
    emitidasComFicha: 0,
    emitidasSemFichaVinculada: 0,
    recuperadas: 0,
    expiradas: 0,
    aprovadasSemApolice: 0,
    tempoEmissao: [],
    tempoCobranca: [],
  }

  emittedPolicies.forEach(apolice => {
    if (apolice?.ficha_id) summary.emitidasComFicha += 1
    else summary.emitidasSemFichaVinculada += 1
  })

  rows.forEach(ficha => {
    const coluna = getColuna(ficha)
    if (isApprovedFicha(ficha)) summary.aprovadas += 1
    if (isSemCobrancaEnviada(ficha)) summary.semCobrancaEnviada += 1
    if (isAguardandoRetorno(ficha)) summary.aguardandoRetorno += 1
    if (coluna === 'expirada') summary.expiradas += 1
    if (isRecovered(ficha)) summary.recuperadas += 1

    if (ficha._hasEmittedPolicy && getEffectiveDataEmissao(ficha) && ficha.created_at) {
      const start = new Date(ficha.created_at)
      const end = new Date(getEffectiveDataEmissao(ficha))
      const days = (end - start) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) summary.tempoEmissao.push(days)
    }

    const cobrancaStart = getRecoveryStart(ficha)
    if (cobrancaStart) {
      const start = new Date(cobrancaStart)
      const end = ficha?.raw_data?.recovered_after_cobranca_em
        ? new Date(ficha.raw_data.recovered_after_cobranca_em)
        : new Date()
      const days = (end - start) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) summary.tempoCobranca.push(days)
    }
  })

  summary.totalFichas = summary.aprovadas
  summary.fichasAprovadas = summary.aprovadas
  summary.aprovadasSemApolice = summary.aprovadas
  summary.totalCobradas = summary.aguardandoRetorno + summary.recuperadas
  summary.taxaEmissao = summary.aprovadas > 0 ? (summary.emitidasComFicha / summary.aprovadas) * 100 : 0
  summary.taxaRecuperacao = summary.totalCobradas > 0 ? (summary.recuperadas / summary.totalCobradas) * 100 : 0
  summary.mediaEmissao = summary.tempoEmissao.length
    ? summary.tempoEmissao.reduce((a, b) => a + b, 0) / summary.tempoEmissao.length
    : null
  summary.mediaCobranca = summary.tempoCobranca.length
    ? summary.tempoCobranca.reduce((a, b) => a + b, 0) / summary.tempoCobranca.length
    : null

  return summary
}

function groupByImobiliaria(rows, resolverNome, emittedPolicies = []) {
  const map = new Map()

  function getNomeGrupo(rawName) {
    return resolverNome(rawName) || normalizeDisplayText(rawName) || '???'
  }

  function ensureGroup(rawName) {
    const nome = getNomeGrupo(rawName)
    const key = normalizeKey(nome)
    const current = map.get(key) || {
      key,
      nome,
      total: 0,
      aprovadas: 0,
      semCobrancaEnviada: 0,
      aguardandoRetorno: 0,
      emitidas: 0,
      emitidasComFicha: 0,
      emitidasSemFichaVinculada: 0,
      recuperadas: 0,
      expiradas: 0,
      mediaEmissao: null,
      mediaCobranca: null,
      logoUrl: null,
      logoPath: null,
      aprovadasSemApolice: 0,
      tempoEmissao: [],
      tempoCobranca: [],
    }
    map.set(key, current)
    return current
  }

  rows.forEach(ficha => {
    const current = ensureGroup(getCanonicalImobiliariaNome(ficha) || ficha.imobiliaria)
    const coluna = getColuna(ficha)
    current.total += 1
    if (isApprovedFicha(ficha)) current.aprovadas += 1
    if (isSemCobrancaEnviada(ficha)) current.semCobrancaEnviada += 1
    if (isAguardandoRetorno(ficha)) current.aguardandoRetorno += 1
    if (coluna === 'expirada') current.expiradas += 1
    if (isRecovered(ficha)) current.recuperadas += 1

    if (ficha._hasEmittedPolicy && getEffectiveDataEmissao(ficha) && ficha.created_at) {
      const days = (new Date(getEffectiveDataEmissao(ficha)) - new Date(ficha.created_at)) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) current.tempoEmissao.push(days)
    }

    const cobrancaStart = getRecoveryStart(ficha)
    if (cobrancaStart) {
      const end = ficha?.raw_data?.recovered_after_cobranca_em
        ? new Date(ficha.raw_data.recovered_after_cobranca_em)
        : new Date()
      const days = (end - new Date(cobrancaStart)) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) current.tempoCobranca.push(days)
    }
  })

  emittedPolicies.forEach(apolice => {
    const current = ensureGroup(apolice?.imobiliaria)
    current.emitidas += 1
    if (apolice?.ficha_id) current.emitidasComFicha += 1
    else current.emitidasSemFichaVinculada += 1
  })

  return [...map.values()].map(item => {
    const totalCobradas = item.aguardandoRetorno + item.recuperadas
    return {
      ...item,
      aprovadasSemApolice: item.aprovadas,
      taxaConversao: item.aprovadas > 0 ? (item.emitidasComFicha / item.aprovadas) * 100 : 0,
      taxaRecuperacao: totalCobradas > 0 ? (item.recuperadas / totalCobradas) * 100 : 0,
      score:
        ((item.aprovadas > 0 ? (item.aprovadas / Math.max(item.total, 1)) : 0) * 35) +
        ((item.emitidasComFicha > 0 && item.aprovadas > 0 ? (item.emitidasComFicha / item.aprovadas) : 0) * 35) +
        ((totalCobradas > 0 ? (item.recuperadas / totalCobradas) : 0) * 20) -
        ((item.tempoEmissao.length ? item.tempoEmissao.reduce((a, b) => a + b, 0) / item.tempoEmissao.length : 0) * 2),
      mediaEmissao: item.tempoEmissao.length ? item.tempoEmissao.reduce((a, b) => a + b, 0) / item.tempoEmissao.length : null,
      mediaCobranca: item.tempoCobranca.length ? item.tempoCobranca.reduce((a, b) => a + b, 0) / item.tempoCobranca.length : null,
    }
  }).sort((a, b) => b.score - a.score)
}

function extractSeguradoraMeta(seg) {
  const aliases = Array.isArray(seg?.aliases)
    ? seg.aliases.filter(Boolean)
    : Array.isArray(seg?.seguradora_aliases)
      ? seg.seguradora_aliases.map(item => item?.alias).filter(Boolean)
      : []
  return {
    id: seg.id,
    nome: seg.nome_canonico,
    logoUrl: seg.logo_url || null,
    logoPath: seg.logo_path || null,
    aliases: [seg.nome_canonico, ...aliases],
  }
}

function matchesSeguradora(ficha, seguradoraMeta) {
  const value = normalizeKey(getEffectiveSeguradora(ficha))
  return seguradoraMeta.aliases.some(alias => normalizeKey(alias) === value)
}

function ChartCard({ title, subtitle, data, dataKey = 'value', xKey = 'name', color = '#000079', formatter = v => v }) {
  return (
    <DataCard title={title} subtitle={subtitle} className="h-full">
      <div className="h-[clamp(16rem,32vw,20rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 8 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey={xKey} width={120} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={value => formatter(value)}
              labelStyle={{ fontWeight: 600 }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 12, 12, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DataCard>
  )
}

function LinhaRelatorio({ ficha, coluna, onOpen, onOpenPolicy, selected, onToggleSelect, onToggleCobranca, onToggleRetornou }) {
  const nome = getNomeFicha(ficha)
  const doc = getDocumento(ficha)
  const op = getOperacionalStatus(ficha)
  const isEmissaoCard = isEmitida(ficha)
  const prodColor = ficha.produto === 'pessoa_juridica' ? '#4b6cc2' : ficha.produto === 'comercial_pf' ? '#0f766e' : '#000079'
  const showCobrancaToggle = isCobrancaEnviadaVisivel(coluna.id)
  const showRetornouToggle = coluna.id === 'enviado_cobranca'
  const cobrancaEnviada = showCobrancaToggle ? getCobrancaEnviadaDisplay(ficha, coluna.id) : false
  const retornou = showRetornouToggle ? getImobiliariaRetornouDisplay(ficha) : false
  const rowClass = coluna.id === 'aprovada'
    ? 'border-red-300 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(254,226,226,0.85))]'
    : 'border-dark-border/60 bg-dark-surface/70'

  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3 transition-colors lg:items-center ${rowClass}`}>
      <button
        type="button"
        onClick={() => onToggleSelect(ficha.id)}
        className="rounded-lg p-1 hover:bg-dark-surface2"
        aria-label="Selecionar linha"
      >
        {selected ? <CheckSquare className="h-4 w-4 text-brand-primary" /> : <Square className="h-4 w-4 text-dark-muted" />}
      </button>

      {ficha._orcamentistaNome && (
        <span title={ficha._orcamentistaNome}>
          <Avatar name={ficha._orcamentistaNome} src={ficha._orcamentistaAvatar} size="sm" />
        </span>
      )}
      {isEmissaoCard && (
        <span title={ficha._emissorNome || 'Sem emissor'}>
          <Avatar name={ficha._emissorNome || 'Sem emissor'} src={ficha._emissorAvatar} size="sm" />
        </span>
      )}

      <button type="button" onClick={() => onOpen(ficha.id)} className="min-w-0 flex-[1_1_20rem] text-left">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${prodColor}20`, color: prodColor }}>
            {normalizeDisplayText(ficha.produto) || ficha.produto || 'Fianca'}
          </span>
          <p className="text-sm font-semibold text-dark-text">{nome}</p>
        </div>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-dark-muted">{getCanonicalImobiliariaNome(ficha)}</p>
      </button>

      <span className={`badge ${op?.color || 'badge-muted'}`}>{op?.label || '—'}</span>

      {doc && (
        <span className="rounded-full border border-dark-border/60 bg-dark-surface2/70 px-2 py-1 text-[10px] font-mono text-dark-muted">
          {doc}
        </span>
      )}

      {getEffectiveNumeroApolice(ficha) && (
        <span className="rounded-full px-2 py-1 text-[10px] font-mono" style={{ background: '#2247aa15', color: '#2247aa' }}>
          Apolice: {getEffectiveNumeroApolice(ficha)}
        </span>
      )}

      {showCobrancaToggle && (
        <button
          type="button"
          onClick={() => onToggleCobranca(ficha, coluna.id, !cobrancaEnviada)}
          className={cobrancaEnviada
            ? 'inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-800'
            : 'inline-flex items-center gap-2 rounded-full border border-dark-border/70 bg-dark-surface/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted hover:border-brand-accent/35 hover:text-dark-text'}
          aria-pressed={cobrancaEnviada}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${cobrancaEnviada ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          Cobranca enviada
        </button>
      )}

      {showRetornouToggle && (
        <button
          type="button"
          onClick={() => onToggleRetornou(ficha, !retornou)}
          className={retornou
            ? 'inline-flex items-center gap-2 rounded-full border border-blue-300 bg-blue-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-800'
            : 'inline-flex items-center gap-2 rounded-full border border-dark-border/70 bg-dark-surface/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted hover:border-brand-accent/35 hover:text-dark-text'}
          aria-pressed={retornou}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${retornou ? 'bg-blue-500' : 'bg-slate-300'}`} />
          Imobiliaria retornou
        </button>
      )}

      {isEmissaoCard && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(ficha.id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dark-border/60 bg-dark-surface/85 px-2.5 py-2 text-[10px] font-semibold text-dark-text transition-colors hover:border-brand-accent/45 hover:text-status-info"
          >
            <FileText className="h-3.5 w-3.5" /> Abrir ficha
          </button>
          <button
            type="button"
            disabled={!ficha?._apolice?.id}
            onClick={() => { if (ficha?._apolice?.id) onOpenPolicy(ficha._apolice.id) }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-2.5 py-2 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir apólice
          </button>
        </div>
      )}
    </div>
  )
}

function BlocoRelatorio({
  coluna,
  fichas,
  onOpen,
  onOpenPolicy,
  selectedIds,
  onToggleSelect,
  onCopy,
  onSelectAll,
  onConfirmCobranca,
  canConfirmCobranca,
  pendingCobrancaCount,
  onToggleCobranca,
  onToggleRetornou,
}) {
  return (
    <DataCard
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: coluna.color }} />
          {coluna.label}
        </span>
      }
      subtitle={`${fichas.length} ficha${fichas.length !== 1 ? 's' : ''}`}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectAll(coluna.id)}
            className="rounded-lg border border-dark-border/60 px-2 py-1 text-[10px] font-medium text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
            title="Selecionar todos deste bloco"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onCopy(coluna.id)}
            className="rounded-lg border border-dark-border/60 px-2 py-1 text-[10px] font-medium text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
            title="Copiar informações dos selecionados deste bloco"
          >
            Copiar
          </button>
          {coluna.id === 'enviado_cobranca' && (
            <button
              type="button"
              onClick={onConfirmCobranca}
              disabled={!canConfirmCobranca}
              className="rounded-lg bg-brand-primary px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              title="Registrar envio de cobranca para as fichas selecionadas em Aprovadas"
            >
              Marcar envio{pendingCobrancaCount > 0 ? ` (${pendingCobrancaCount})` : ''}
            </button>
          )}
        </div>
      }
    >
      {fichas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-dark-muted">
          <Square className="h-5 w-5 opacity-30" />
          <span className="text-xs">Vazia</span>
        </div>
      ) : (
        <div className="space-y-2">
          {fichas.map(ficha => (
            <LinhaRelatorio
              key={ficha.id}
              ficha={ficha}
              coluna={coluna}
              onOpen={onOpen}
              onOpenPolicy={onOpenPolicy}
              selected={selectedIds.has(ficha.id)}
              onToggleSelect={onToggleSelect}
              onToggleCobranca={onToggleCobranca}
              onToggleRetornou={onToggleRetornou}
            />
          ))}
        </div>
      )}
    </DataCard>
  )
}

function PeriodControl({ periodo, ano, mes, anos, onPeriod, onAno, onMes }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-2xl border border-dark-border/60 bg-dark-surface/70 p-1">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPeriod(opt.value)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              periodo === opt.value ? 'bg-brand-primary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {periodo !== 'historico' && (
        <Select
          value={String(ano)}
          onChange={value => onAno(Number(value))}
          options={anos.map(item => ({ value: String(item), label: String(item) }))}
          className="w-24"
        />
      )}

      {periodo === 'mes' && (
        <div className="flex items-center gap-1 flex-wrap">
          {MESES_ABBR.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => onMes(index + 1)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                mes === index + 1 ? 'bg-brand-primary text-white shadow-sm' : 'text-dark-text hover:bg-dark-surface2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectedToolbar({
  count,
  onClear,
  onSelectAll,
  onInvertSelection,
  onMove,
  onBulkCopy,
  onConfirmCobranca,
  canConfirmCobranca,
  pendingCobrancaCount,
  options,
  target,
  setTarget,
}) {
  return (
    <DataCard className="border-brand-accent/15 bg-brand-accent/5" bodyClassName="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Selecao em massa</p>
          <p className="mt-1 text-sm text-dark-text">{count} ficha{count !== 1 ? 's' : ''} selecionada{count !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSelectAll} className="btn-secondary text-xs">
            Selecionar todos
          </button>
          <button type="button" onClick={onClear} className="btn-secondary text-xs" disabled={count === 0}>
            Deselecionar todos
          </button>
          <button type="button" onClick={onInvertSelection} className="btn-secondary text-xs">
            Inverter seleção
          </button>
          <button type="button" onClick={onBulkCopy} className="btn-secondary text-xs" disabled={count === 0}>
            Copiar selecionadas
          </button>
          <button
            type="button"
            onClick={onConfirmCobranca}
            className="btn-primary text-xs"
            disabled={!canConfirmCobranca}
          >
            Marcar envio{pendingCobrancaCount > 0 ? ' (' + pendingCobrancaCount + ')' : ''}
          </button>
          <Select
            value={target}
            onChange={setTarget}
            options={[
              { value: '', label: 'Mover para coluna...' },
              ...options.map(opt => ({ value: opt.id, label: opt.label })),
            ]}
            className="w-52"
          />
          <button type="button" onClick={onMove} className="btn-primary text-xs" disabled={!target || count === 0}>
            Mover
          </button>
        </div>
      </div>
    </DataCard>
  )
}

function EmptyState({ title, description, icon: Icon }) {
  return (
    <DataCard className="py-16 text-center">
      <div className="flex flex-col items-center justify-center gap-2 text-dark-muted">
        <Icon className="h-8 w-8 opacity-30" />
        <p className="text-sm font-medium text-dark-text">{title}</p>
        <p className="max-w-md text-xs text-dark-muted">{description}</p>
      </div>
    </DataCard>
  )
}

function ModalEmitirApolice({ ficha, salvando, onCancelar, onConfirmar }) {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [emitidoPor, setEmitidoPor] = useState(user?.id || '')
  const [proprietarioNome, setProprietarioNome] = useState(normalizeDisplayText(ficha.nome_empresa || ficha.nome_interessado) || '')
  const [proprietarioCel, setProprietarioCel] = useState(ficha.celular || '')
  const [numeroApolice, setNumeroApolice] = useState(getEffectiveNumeroApolice(ficha) || '')
  const [numeroProposta, setNumeroProposta] = useState('')
  const [endereco, setEndereco] = useState(ficha.cep || '')
  const [inicioVigencia, setInicioVigencia] = useState('')
  const [fimVigencia, setFimVigencia] = useState('')
  const [valorParcela, setValorParcela] = useState(ficha.valor_aluguel ? String(ficha.valor_aluguel) : '')
  const [parcelamento, setParcelamento] = useState(ficha.parcelamento ? String(ficha.parcelamento) : '')
  const [premioLiquido, setPremioLiquido] = useState('')
  const [pctComissao, setPctComissao] = useState(ficha.pct_comissao ?? '')
  const [pctDesconto, setPctDesconto] = useState(ficha.pct_desconto ?? '')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [seguradora, setSeguradora] = useState(getEffectiveSeguradora(ficha) || '')

  const meses = inicioVigencia && fimVigencia
    ? Math.max(0, Math.round((new Date(fimVigencia) - new Date(inicioVigencia)) / (1000 * 60 * 60 * 24 * 30)))
    : 0
  const qtdParcelas = toNumber(parcelamento) || 0
  const valorParcelaNum = toNumber(valorParcela) || 0
  const premioLiquidoNum = toNumber(premioLiquido) || 0
  const premioTotal = qtdParcelas > 0 && valorParcelaNum > 0 ? valorParcelaNum * qtdParcelas : null
  const valorComissao = premioLiquidoNum > 0 && pctComissao !== '' ? (premioLiquidoNum * (toNumber(pctComissao) > 1 ? toNumber(pctComissao) / 100 : toNumber(pctComissao))) : null

  const obrigatoriosOK = proprietarioNome.trim() && numeroApolice.trim()
    && inicioVigencia && fimVigencia && parcelamento && valorParcela && formaPagamento && seguradora
    && premioLiquido !== '' && pctComissao !== '' && pctDesconto !== ''

  useEffect(() => {
    supabase.from('profiles').select('id, nome, avatar_url').order('nome').then(({ data }) => setProfiles(data || []))
  }, [])

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={!salvando ? onCancelar : undefined} />
      <div className="relative glass-modal w-full max-w-2xl overflow-hidden border border-dark-border">
        <div className="flex items-center justify-between gap-3 border-b border-dark-border px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Emissão pelo relatório</p>
            <h3 className="mt-1 text-lg font-semibold text-dark-text">{normalizeDisplayText(ficha.nome_interessado || ficha.nome_empresa) || 'Ficha selecionada'}</h3>
          </div>
          <button onClick={onCancelar} className="text-dark-muted hover:text-dark-text" disabled={salvando}>×</button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome do Proprietário" value={proprietarioNome} onChange={setProprietarioNome} required />
            <Field label="Celular do Proprietário" value={proprietarioCel} onChange={setProprietarioCel} />
            <Field label="Numero da Apolice" value={numeroApolice} onChange={setNumeroApolice} required />
            <Field label="Numero da Proposta" value={numeroProposta} onChange={setNumeroProposta} />
            <div className="sm:col-span-2">
              <Field label="Endereco do Imóvel" value={endereco} onChange={setEndereco} />
            </div>
            <Field type="date" label="Inicio da Vigencia" value={inicioVigencia} onChange={setInicioVigencia} required />
            <Field type="date" label="Fim da Vigencia" value={fimVigencia} onChange={setFimVigencia} required />
            <ReadOnly label="Tempo de Vigência" value={meses > 0 ? `${meses} meses` : '—'} />
            <Field type="number" label="Parcelamento (vezes)" value={parcelamento} onChange={setParcelamento} required />
            <Field type="number" label="Valor da Parcela (R$)" value={valorParcela} onChange={setValorParcela} required />
            <Field type="number" label="Premio Liquido (R$)" value={premioLiquido} onChange={setPremioLiquido} required />
            <Field type="number" label="% Comissão" value={pctComissao} onChange={setPctComissao} required />
            <Field type="number" label="% Desconto" value={pctDesconto} onChange={setPctDesconto} required />
            <ReadOnly label="Premio total" value={premioTotal != null ? formatMoneyBR(premioTotal) : '—'} />
            <ReadOnly label="Comissão calculada" value={valorComissao != null ? formatMoneyBR(valorComissao) : '—'} />
            <div className="sm:col-span-2">
              <Select
                value={formaPagamento}
                onChange={setFormaPagamento}
                options={[
                  { value: '', label: 'Selecione...' },
                  { value: 'fatura_sem_entrada', label: 'Fatura sem entrada' },
                  { value: 'fatura_com_entrada', label: 'Fatura com entrada' },
                  { value: 'cartao_credito', label: 'Cartão de crédito' },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <Select
                value={seguradora}
                onChange={setSeguradora}
                options={[
                  { value: '', label: 'Selecione...' },
                  { value: 'Porto Seguro', label: 'Porto Seguro' },
                  { value: 'Pottencial Seguros', label: 'Pottencial Seguros' },
                  { value: 'TOO Seguros', label: 'TOO Seguros' },
                  { value: 'Tokio Marine', label: 'Tokio Marine' },
                  { value: 'Junto Seguros', label: 'Junto Seguros' },
                  { value: 'Outras', label: 'Outras' },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <Select
                value={emitidoPor}
                onChange={setEmitidoPor}
                options={profiles.map(profile => ({ value: profile.id, label: profile.nome }))}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-dark-border px-6 py-4">
          <button onClick={onCancelar} className="btn-secondary text-sm" disabled={salvando}>Cancelar</button>
          <button
            onClick={() => obrigatoriosOK && onConfirmar({
              proprietarioNome,
              proprietarioCel,
              numeroApolice,
              numeroProposta,
              endereco,
              seguradora,
              inicioVigencia,
              fimVigencia,
              parcelamento,
              valorParcela: valorParcelaNum,
              premioLiquido: premioLiquidoNum,
              pctComissao,
              pctDesconto,
              formaPagamento,
              emitidoPor,
            })}
            disabled={!obrigatoriosOK || salvando}
            className="btn-primary text-sm"
          >
            {salvando ? 'Salvando...' : 'Confirmar Emissão'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalConfirmarCobranca({ fichas, salvando, onCancelar, onConfirmar }) {
  const preview = fichas.slice(0, 5)

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!salvando) onCancelar()
      }}
      title={`Registrar envio para ${fichas.length} ficha${fichas.length !== 1 ? 's' : ''}`}
      subtitle="Confirmar cobran?a"
      maxWidth="xl"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancelar} className="btn-secondary" disabled={salvando}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Confirmar envio'}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-brand-accent/15 bg-brand-accent/5 p-4">
          <p className="text-sm text-dark-text">
            Ao confirmar, as fichas selecionadas ser?o registradas como <strong>cobran?a enviada</strong> e a data do envio ser? salva automaticamente.
          </p>
        </div>

        <div className="space-y-2">
          {preview.map(ficha => (
            <div key={ficha.id} className="rounded-2xl border border-dark-border/60 bg-dark-surface/70 px-3 py-2">
              <p className="text-sm font-semibold text-dark-text">{getNomeFicha(ficha)}</p>
              <p className="text-[11px] text-dark-muted">{getCanonicalImobiliariaNome(ficha)}</p>
            </div>
          ))}
          {fichas.length > preview.length && (
            <p className="text-xs text-dark-muted">
              + {fichas.length - preview.length} ficha{fichas.length - preview.length !== 1 ? 's' : ''} adicional{fichas.length - preview.length !== 1 ? 'is' : ''}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div className="group relative rounded-3xl border border-transparent px-2 py-1.5 transition-all hover:border-brand-accent/20 hover:bg-dark-surface2/20">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-muted">
        {label}{required && <span className="ml-0.5 text-status-danger">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value || ''}
          onChange={event => onChange(event.target.value)}
          className="input text-sm"
        />
      </div>
    </div>
  )
}

function ReadOnly({ label, value }) {
  return (
    <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 px-4 py-3 text-sm text-dark-text">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function ModalResumoRelatorio({ titulo, descricao, secaoEnvio, secaoRetorno, onFechar }) {
  return (
    <div className="fixed inset-0 z-[520] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={onFechar} />
      <div className="relative glass-modal w-full max-w-2xl overflow-hidden border border-dark-border">
        <div className="flex items-center justify-between gap-3 border-b border-dark-border px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Resumo do relatório</p>
            <h3 className="mt-1 text-lg font-semibold text-dark-text">{titulo}</h3>
          </div>
          <button onClick={onFechar} className="text-dark-muted hover:text-dark-text">×</button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-dark-muted">{descricao}</p>

          {secaoEnvio?.length > 0 && (
            <div className="rounded-3xl border border-red-300 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Imobiliárias sem cobrança enviada</p>
              <div className="mt-3 space-y-2">
                {secaoEnvio.map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm text-red-900 shadow-sm">
                    <span className="font-medium">{item.nome}</span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">{item.semCobranca} ficha{item.semCobranca !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {secaoRetorno?.length > 0 && (
            <div className="rounded-3xl border border-orange-300 bg-orange-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-800">Imobiliárias sem retorno confirmado</p>
              <div className="mt-3 space-y-2">
                {secaoRetorno.map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm text-orange-950 shadow-sm">
                    <span className="font-medium">{item.nome}</span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">{item.semRetorno} ficha{item.semRetorno !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={onFechar} className="rounded-2xl border border-dark-border px-4 py-2 text-sm text-dark-muted transition-colors hover:text-dark-text">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalFinalizarRelatorio({ periodoLabel, resumo, salvando, onCancelar, onConfirmar, onAbrirImobiliaria }) {
  const semCobranca = Array.isArray(resumo?.semCobranca) ? resumo.semCobranca : []
  const semRetorno = Array.isArray(resumo?.semRetorno) ? resumo.semRetorno : []
  const temEnvioPendente = semCobranca.length > 0
  const temRetornoPendente = semRetorno.length > 0
  const temPendencias = temEnvioPendente || temRetornoPendente
  const totalSemCobranca = semCobranca.reduce((acc, item) => acc + (item.semCobranca || 0), 0)
  const totalSemRetorno = semRetorno.reduce((acc, item) => acc + (item.semRetorno || 0), 0)
  const totalImobiliarias = new Set([
    ...semCobranca.map(item => item.key),
    ...semRetorno.map(item => item.key),
  ]).size
  const footer = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancelar}
        disabled={salvando}
        className="rounded-2xl border border-dark-border px-4 py-2 text-sm text-dark-muted transition-colors hover:text-dark-text disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirmar}
        disabled={salvando}
        className="rounded-2xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : temPendencias ? 'Finalizar mesmo assim' : 'Finalizar relatório'}
      </button>
    </div>
  )

  function renderPendenciaCard(item, colunaId, label, quantidade, tone) {
    const toneClass = tone === 'danger'
      ? 'border-red-200 bg-white/95 hover:border-red-300 hover:bg-red-50/70'
      : 'border-orange-200 bg-white/95 hover:border-orange-300 hover:bg-orange-50/70'
    const badgeClass = tone === 'danger'
      ? 'bg-red-100 text-red-700'
      : 'bg-orange-100 text-orange-700'

    return (
      <button
        key={`${colunaId}:${item.key}`}
        type="button"
        onClick={() => onAbrirImobiliaria?.(item.nome, colunaId)}
        className={`group w-full rounded-[22px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-dark-text">{item.nome}</p>
            <p className="mt-1 text-xs text-dark-muted">
              Abrir a seção com as fichas deste mês dessa imobiliária.
            </p>
          </div>
          <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClass}`}>
            {quantidade} ficha{quantidade !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-dark-muted">{label}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary">
            Ver fichas <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>
    )
  }

  return (
    <Modal
      isOpen
      onClose={!salvando ? onCancelar : () => {}}
      title={`Finalizar relatório de ${periodoLabel}`}
      subtitle="Finalização mensal"
      maxWidth="xl"
      footer={footer}
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-dark-border/70 bg-dark-surface/70 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Imobiliárias</p>
            <p className="mt-2 text-2xl font-semibold text-dark-text">{totalImobiliarias}</p>
            <p className="mt-1 text-xs text-dark-muted">Com alguma ação pendente neste fechamento.</p>
          </div>
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">Sem cobrança</p>
            <p className="mt-2 text-2xl font-semibold text-red-800">{totalSemCobranca}</p>
            <p className="mt-1 text-xs text-red-700">Fichas aprovadas que ainda não tiveram cobrança enviada.</p>
          </div>
          <div className="rounded-[24px] border border-orange-200 bg-orange-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">Aguardando retorno</p>
            <p className="mt-2 text-2xl font-semibold text-orange-800">{totalSemRetorno}</p>
            <p className="mt-1 text-xs text-orange-700">Fichas em cobrança aguardando retorno da imobiliária.</p>
          </div>
        </div>

        <div className={`rounded-[28px] border p-4 ${temPendencias ? 'border-red-200 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,247,237,0.92))]' : 'border-emerald-300 bg-emerald-50'}`}>
          <p className={`text-sm font-semibold ${temPendencias ? 'text-slate-900' : 'text-emerald-800'}`}>
            {temPendencias
              ? 'Antes de finalizar, revise as pendências abaixo. O clique em uma imobiliária leva direto ao bloco com as fichas desse mês.'
              : 'Nenhuma pendência encontrada. O fechamento deste mês está pronto para ser confirmado.'}
          </p>
          <p className={`mt-2 text-sm ${temPendencias ? 'text-slate-600' : 'text-emerald-700'}`}>
            {temPendencias
              ? 'A lista fica dentro do modal e cada item já abre o relatório individual na seção correta.'
              : 'Confirme para registrar o fechamento mensal.'}
          </p>
        </div>

        {temPendencias && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[28px] border border-red-200 bg-red-50/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Sem cobrança enviada</p>
                  <p className="mt-1 text-sm text-red-800">Abra a coluna de aprovadas para agir nas fichas pendentes.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700 shadow-sm">
                  {semCobranca.length} imobiliária{semCobranca.length !== 1 ? 's' : ''}
                </span>
              </div>
              {temEnvioPendente ? (
                <div className="mt-4 max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                  {semCobranca.map(item => renderPendenciaCard(item, 'aprovada', 'Ir para Aprovadas', item.semCobranca, 'danger'))}
                </div>
              ) : (
                <div className="mt-4 rounded-[22px] border border-emerald-200 bg-white/90 px-4 py-5 text-sm text-emerald-800">
                  Nenhuma imobiliária com cobrança pendente neste mês.
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-orange-200 bg-orange-50/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-800">Aguardando retorno</p>
                  <p className="mt-1 text-sm text-orange-900">Abra a coluna de cobrança para ver as fichas aguardando retorno.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700 shadow-sm">
                  {semRetorno.length} imobiliária{semRetorno.length !== 1 ? 's' : ''}
                </span>
              </div>
              {temRetornoPendente ? (
                <div className="mt-4 max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                  {semRetorno.map(item => renderPendenciaCard(item, 'enviado_cobranca', 'Ir para Cobrança', item.semRetorno, 'warning'))}
                </div>
              ) : (
                <div className="mt-4 rounded-[22px] border border-emerald-200 bg-white/90 px-4 py-5 text-sm text-emerald-800">
                  Nenhuma imobiliária aguardando retorno neste mês.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function Relatorio() {
  const navigate = useNavigate()
  const location = useLocation()
  const { imobiliariaId } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const { resolverNome, resolverImobiliariaInfo, getAliases } = useImobiliaria()

  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const agora = new Date()
  const periodo = query.get('periodo') || 'mes'
  const ano = Number(query.get('ano') || agora.getFullYear())
  const mes = Number(query.get('mes') || agora.getMonth() + 1)

  const [rows, setRows] = useState([])
  const [years, setYears] = useState([agora.getFullYear()])
  const [imobiliarias, setImobiliarias] = useState([])
  const [seguradoras, setSeguradoras] = useState([])
  const [emittedPolicies, setEmittedPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [moveTarget, setMoveTarget] = useState('')
  const [pendingEmissao, setPendingEmissao] = useState(null)
  const [salvandoEmissao, setSalvandoEmissao] = useState(false)
  const [pendingCobranca, setPendingCobranca] = useState(null)
  const [salvandoCobranca, setSalvandoCobranca] = useState(false)
  const [finalizacoesMap, setFinalizacoesMap] = useState(() => readJsonStorage(RELATORIO_FINALIZADO_STORAGE, {}))
  const [pendingFinalizacao, setPendingFinalizacao] = useState(null)
  const [alertaRelatorioDetalhe, setAlertaRelatorioDetalhe] = useState(null)
  const [cobrancaToggleMap, setCobrancaToggleMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(COBRANCA_TOGGLE_STORAGE) || '{}')
    } catch {
      return {}
    }
  })
  const isDetail = Boolean(imobiliariaId)
  const columnSectionRefs = useRef({})
  const handledSectionFocusRef = useRef('')
  const currentPath = `${location.pathname}${location.search}`

  const periodoScopeKey = getPeriodoScopeKey(periodo, ano, mes)
  const [rangeStart, rangeEnd] = getReportRange(periodo, ano, mes)
  const periodoLabel = getPeriodoLabel(periodo, ano, mes)
  const periodoAnterior = useMemo(() => {
    if (periodo !== 'mes') return null
    const ref = new Date(ano, mes - 1, 1)
    ref.setMonth(ref.getMonth() - 1)
    return {
      ano: ref.getFullYear(),
      mes: ref.getMonth() + 1,
      label: getPeriodoLabel('mes', ref.getFullYear(), ref.getMonth() + 1),
      scopeKey: getPeriodoScopeKey('mes', ref.getFullYear(), ref.getMonth() + 1),
    }
  }, [periodo, ano, mes])

  useEffect(() => {
    async function loadStatic() {
      try {
        const [yearsRows, imobRows, segRows] = await Promise.all([
          fetchAllRows(() => supabase.from('fichas').select('created_at').in('status', REPORT_STATUSES)),
          supabase.from('imobiliarias').select('id, nome_canonico, imagem_url, imagem_path, ativa').order('nome_canonico'),
          fetchSeguradorasPorProduto('fianca'),
        ])

        setYears([...new Set(yearsRows.map(row => new Date(row.created_at).getFullYear()))].sort((a, b) => b - a))
        setImobiliarias(imobRows.data || [])
        setSeguradoras((segRows || []).map(extractSeguradoraMeta))
      } catch (error) {
        toast({ type: 'error', title: 'Erro ao carregar cadastros', message: error.message })
      }
    }

    loadStatic()
  }, [toast])

  useEffect(() => {
    let active = true

    async function loadRows() {
      setLoading(true)
      try {
        let imobiliariaAliases = null
        if (isDetail) {
          const imob = imobiliarias.find(item => String(item.id) === String(imobiliariaId))
          if (!imob) {
            const { data } = await supabase.from('imobiliarias').select('id, nome_canonico, imagem_url, imagem_path, ativa').eq('id', imobiliariaId).single()
            if (data) {
              const { data: aliasData } = await supabase.from('imobiliaria_aliases').select('alias').eq('imobiliaria_id', data.id)
              imobiliariaAliases = [data.nome_canonico, ...(aliasData || []).map(item => item.alias).filter(Boolean)]
            }
          } else {
            const aliases = await getAliases(imob.nome_canonico)
            imobiliariaAliases = aliases.length ? aliases : [imob.nome_canonico]
          }
        }

        const createdRowsQuery = () => {
          let query = supabase
            .from('fichas')
            .select('id, created_at, finalizada_em, nome_interessado, nome_empresa, cpf, cnpj, cep, imobiliaria, status, produto, retorno_enviado, seguradora, orcamentista_forms, observacoes, raw_data, numero_apolice, data_emissao, valor_aluguel, assumida, orcamentista_id, profiles!orcamentista_id(nome, avatar_url)')
            .in('status', REPORT_STATUSES)
            .order('created_at', { ascending: false })

          if (rangeStart && rangeEnd) {
            query = query.gte('created_at', rangeStart).lte('created_at', rangeEnd)
          }
          if (imobiliariaAliases?.length) {
            query = query.in('imobiliaria', imobiliariaAliases)
          }

          return query
        }

        const apolicesRangeRowsQuery = () => {
          let query = supabase
            .from('apolices')
            .select('id, ficha_id, numero_apolice, data_emissao, status_emissao, seguradora, imobiliaria, emitido_por, profiles!emitido_por(nome, avatar_url)')
            .in('status_emissao', ['emitida', 'enviada'])

          if (rangeStart && rangeEnd) {
            query = query.gte('data_emissao', rangeStart).lte('data_emissao', rangeEnd)
          }
          if (imobiliariaAliases?.length) {
            query = query.in('imobiliaria', imobiliariaAliases)
          }

          return query
        }

        const [createdRows, emittedRangeRows] = await Promise.all([
          fetchAllRows(createdRowsQuery),
          fetchAllRows(apolicesRangeRowsQuery),
        ])
        if (!active) return

        setEmittedPolicies(emittedRangeRows || [])

        const baseRows = createdRows || []
        const emittedIds = (emittedRangeRows || []).map(item => item.ficha_id).filter(Boolean)
        const allIds = [...new Set([...baseRows.map(item => item.id), ...emittedIds])]

        if (allIds.length === 0) {
          setRows([])
          return
        }

        const finalRows = await fetchAllRows(() => {
          return supabase
            .from('fichas')
            .select('id, created_at, finalizada_em, nome_interessado, nome_empresa, cpf, cnpj, cep, imobiliaria, status, produto, retorno_enviado, seguradora, orcamentista_forms, observacoes, raw_data, numero_apolice, data_emissao, valor_aluguel, assumida, orcamentista_id, profiles!orcamentista_id(nome, avatar_url)')
            .in('id', allIds)
            .order('created_at', { ascending: false })
        })
        if (!active) return

        const fichaRows = finalRows || []
        const fichaIds = fichaRows.map(item => item.id).filter(Boolean)
        let apolicesByFicha = new Map()

        if (fichaIds.length > 0) {
          const apolicesData = await fetchAllRows(() => (
            supabase
              .from('apolices')
              .select('id, ficha_id, numero_apolice, data_emissao, status_emissao, seguradora, imobiliaria, emitido_por, profiles!emitido_por(nome, avatar_url)')
              .in('ficha_id', fichaIds)
              .in('status_emissao', ['emitida', 'enviada'])
          ))

          apolicesByFicha = new Map()
          ;(apolicesData || []).forEach(apolice => {
            const current = apolicesByFicha.get(apolice.ficha_id)
            if (!current) {
              apolicesByFicha.set(apolice.ficha_id, apolice)
              return
            }

            const currentDate = new Date(current.data_emissao || 0).getTime()
            const nextDate = new Date(apolice.data_emissao || 0).getTime()
            if (nextDate >= currentDate) apolicesByFicha.set(apolice.ficha_id, apolice)
          })
        }

        setRows(fichaRows.map(ficha => {
          const apolice = apolicesByFicha.get(ficha.id) || null
          const hasPolicy = Boolean(
            (apolice?.numero_apolice && ['emitida', 'enviada'].includes(apolice?.status_emissao || 'emitida')) ||
            ficha.numero_apolice
          )

          return {
            ...ficha,
            _apolice: apolice,
            _hasEmittedPolicy: hasPolicy,
            _effectiveNumeroApolice: apolice?.numero_apolice || ficha.numero_apolice || null,
            _effectiveDataEmissao: apolice?.data_emissao || ficha.data_emissao || null,
            _effectiveSeguradora: apolice?.seguradora || ficha.seguradora || null,
            _orcamentistaNome: ficha.profiles?.nome || null,
            _orcamentistaAvatar: ficha.profiles?.avatar_url || null,
            _emissorNome: apolice?.profiles?.nome || null,
            _emissorAvatar: apolice?.profiles?.avatar_url || null,
          }
        }).filter(isEligibleReportRow))
      } catch (error) {
        if (!active) return
        toast({ type: 'error', title: 'Erro ao carregar relatorios', message: error.message })
        setRows([])
        setEmittedPolicies([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRows()
    return () => { active = false }
  }, [ano, mes, periodo, rangeStart, rangeEnd, imobiliariaId, imobiliarias, getAliases, isDetail, toast])

  useEffect(() => {
    if (typeof location.state?.scrollTop !== 'number') return
    requestAnimationFrame(() => {
      window.scrollTo({ top: location.state.scrollTop, behavior: 'auto' })
    })
  }, [location.state])

  const [focusedSectionId, setFocusedSectionId] = useState('')

  useEffect(() => {
    if (!isDetail || loading) return

    const focusSectionId = location.state?.focusSectionId
    if (!focusSectionId) return

    const nextKey = `${location.pathname}|${location.search}|${focusSectionId}|${location.state?.focusNonce || '0'}`
    if (handledSectionFocusRef.current === nextKey) return

    const target = columnSectionRefs.current[focusSectionId]
    if (!target) return

    handledSectionFocusRef.current = nextKey
    const frameId = requestAnimationFrame(() => {
      setFocusedSectionId(focusSectionId)
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    const timeoutId = setTimeout(() => {
      setFocusedSectionId(current => (current === focusSectionId ? '' : current))
    }, 2200)

    return () => {
      cancelAnimationFrame(frameId)
      clearTimeout(timeoutId)
    }
  }, [isDetail, loading, location.pathname, location.search, location.state])

  useEffect(() => {

    localStorage.setItem(COBRANCA_TOGGLE_STORAGE, JSON.stringify(cobrancaToggleMap))
  }, [cobrancaToggleMap])

  useEffect(() => {
    writeJsonStorage(RELATORIO_FINALIZADO_STORAGE, finalizacoesMap)
  }, [finalizacoesMap])

  const filteredImobiliarias = useMemo(() => {
    const term = normalizeKey(search)
    const base = imobiliarias.filter(item => item?.nome_canonico)
    if (!term) return base
    return base.filter(item => normalizeKey(item.nome_canonico).includes(term))
  }, [imobiliarias, search])

  const rowsWithHelpers = useMemo(() => {
    return rows.map(item => ({
      ...item,
      _nome: getNomeFicha(item),
      _oper: getOperacionalStatus(item),
      _key: resolverNome(item.imobiliaria),
      _logo: resolverImobiliariaInfo(item.imobiliaria),
      _imobiliariaNome: resolverImobiliariaInfo(item.imobiliaria)?.nome_canonico || resolverNome(item.imobiliaria) || item.imobiliaria || '—',
    }))
  }, [rows, resolverNome, resolverImobiliariaInfo])

  const summary = useMemo(() => summarizeRows(rowsWithHelpers, emittedPolicies), [rowsWithHelpers, emittedPolicies])
  const groupedByImob = useMemo(() => groupByImobiliaria(rowsWithHelpers, resolverNome, emittedPolicies), [rowsWithHelpers, resolverNome, emittedPolicies])
    const resumoFechamento = useMemo(() => {
    const map = new Map()

    rowsWithHelpers.forEach(item => {
      const coluna = getColuna(item)
      const nomeImob = resolverImobiliariaInfo(item.imobiliaria)?.nome_canonico || resolverNome(item.imobiliaria) || item.imobiliaria || '—'
      const key = normalizeKey(nomeImob)
      const current = map.get(key) || {
        key,
        nome: nomeImob,
        semCobranca: 0,
        semRetorno: 0,
      }

      if (coluna === 'aprovada' && !isEmitida(item)) {
        current.semCobranca += 1
      }
      if (coluna === 'enviado_cobranca' && !getImobiliariaRetornouDisplay(item)) {
        current.semRetorno += 1
      }

      map.set(key, current)
    })

    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [rowsWithHelpers, resolverNome, resolverImobiliariaInfo])

  const resumoFinalizacao = useMemo(() => ({
    semCobranca: resumoFechamento.filter(item => item.semCobranca > 0),
    semRetorno: resumoFechamento.filter(item => item.semRetorno > 0),
  }), [resumoFechamento])

  const alertaTopo = useMemo(() => {
    if (!periodoAnterior) return null

    const finalizacaoAnterior = finalizacoesMap?.[periodoAnterior.scopeKey]
    if (!finalizacaoAnterior) {
      return {
        tipo: 'danger',
        titulo: 'Relatório do mês passado não foi finalizado',
        descricao: `${periodoAnterior.label} ainda está em aberto.`,
        periodoAnterior,
      }
    }

    if ((finalizacaoAnterior.semRetorno || []).length > 0) {
      return {
        tipo: 'warning',
        titulo: `As fichas de ${periodoAnterior.label} foram cobradas, mas nem todas tiveram retorno`,
        descricao: 'Clique para ver as imobiliárias com cobrança pendente de retorno.',
        periodoAnterior,
        detalhe: finalizacaoAnterior,
      }
    }

    return null
  }, [periodoAnterior, finalizacoesMap])

  const columnMap = useMemo(() => {
    const map = Object.fromEntries(COLUNAS.map(col => [col.id, []]))
    rowsWithHelpers.forEach(item => {
      const col = getColuna(item)
      if (col && map[col]) map[col].push(item)
    })
    return map
  }, [rowsWithHelpers])

  const visibleIds = useMemo(() => rowsWithHelpers.map(item => item.id), [rowsWithHelpers])
  const selectedRows = useMemo(() => rowsWithHelpers.filter(item => selectedIds.includes(item.id)), [rowsWithHelpers, selectedIds])
  const pendingCobrancaCount = useMemo(
    () => selectedRows.filter(item => getColuna(item) === 'aprovada').length,
    [selectedRows],
  )
  const canConfirmCobranca = selectedRows.length > 0 && selectedRows.every(item => getColuna(item) === 'aprovada')

  function updateQuery(next) {
    const params = new URLSearchParams(location.search)
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') params.delete(key)
      else params.set(key, String(value))
    })
    navigate({ pathname: isDetail ? `/relatorio/${imobiliariaId}` : '/relatorio', search: params.toString() ? `?${params.toString()}` : '' }, { replace: true })
  }

  function openImobiliariaReport(imobId, options = {}) {
    const nextState = {}

    if (!isDetail) {
      nextState.scrollTopOverview = window.scrollY
    }
    if (options.focusSectionId) {
      nextState.focusSectionId = options.focusSectionId
      nextState.focusNonce = Date.now()
    }

    navigate(
      { pathname: `/relatorio/${imobId}`, search: location.search },
      { state: Object.keys(nextState).length ? nextState : undefined },
    )
  }

  function onChangePeriodo(next) {

    if (next === 'historico') {
      updateQuery({ periodo: next })
      return
    }
    updateQuery({ periodo: next, ano, mes })
  }

  function onChangeAno(next) {
    updateQuery({ ano: next })
  }

  function onChangeMes(next) {
    updateQuery({ mes: next })
  }

  function getCobrancaToggleKey(imobKey) {
    return `${periodoScopeKey}:${imobKey}`
  }

  function isCobrancaDone(imobKey) {
    return Boolean(cobrancaToggleMap[getCobrancaToggleKey(imobKey)])
  }

  function toggleCobrancaDone(imobKey) {
    const storageKey = getCobrancaToggleKey(imobKey)
    setCobrancaToggleMap(prev => ({
      ...prev,
      [storageKey]: !prev[storageKey],
    }))
  }

  function openFicha(id) {
    navigate(`/fichas/${id}`, {
      state: {
        backTo: currentPath,
        backState: { scrollTop: window.scrollY },
      },
    })
  }

  function openApolice(id) {
    navigate(`/apolices/${id}`, {
      state: {
        backTo: currentPath,
        backState: { scrollTop: window.scrollY },
      },
    })
  }

  function toggleSelected(id) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }

  function selectAllVisible() {
    setSelectedIds(visibleIds)
  }

  function clearSelection() {
    setSelectedIds([])
    setMoveTarget('')
  }

  function invertSelection() {
    setSelectedIds(prev => visibleIds.filter(id => !prev.includes(id)))
  }

  function selectAllColumn(colunaId) {
    const ids = (columnMap[colunaId] || []).map(item => item.id)
    setSelectedIds(ids)
  }

  async function copyColumn(colunaId) {
    const selectedInColumn = (columnMap[colunaId] || []).filter(item => selectedIds.includes(item.id))
    const text = buildCopyLines(selectedInColumn, colunaId)
    if (!text) {
      toast({ type: 'info', title: 'Selecione os cards que deseja copiar nesta coluna' })
      return
    }
    await navigator.clipboard.writeText(text)
    toast({ type: 'success', title: 'Informacoes copiadas' })
  }

  async function copySelected() {
    const map = new Map(rowsWithHelpers.map(item => [item.id, item]))
    const text = selectedIds.map(id => {
      const item = map.get(id)
      if (!item) return null
      const status = item._oper?.label || '—'
      return `${item._nome} - ${getCanonicalImobiliariaNome(item)} - ${formatDateBR(item.created_at)} - Status (${status}) - ${item.cep || '—'}`
    }).filter(Boolean).join('\n')

    if (!text) {
      toast({ type: 'info', title: 'Nenhum registro para copiar' })
      return
    }

    await navigator.clipboard.writeText(text)
    toast({ type: 'success', title: 'Selecionadas copiadas' })
  }

  async function moveSelected() {
    if (!moveTarget || selectedIds.length === 0) return
    if (moveTarget === 'enviado_cobranca') {
      openConfirmarCobranca()
      return
    }
    if (moveTarget !== 'aprovada') return

    if (selectedRows.some(item => getColuna(item) !== 'enviado_cobranca')) {
      toast({ type: 'info', title: 'Selecione apenas fichas da coluna Enviado Cobrança', message: 'O retorno em massa para Aprovadas só pode ser feito com fichas que já estavam em cobrança.' })
      return
    }

    const previousRows = rows
    const targetRows = [...selectedRows]
    const patchById = new Map(targetRows.map(item => [item.id, buildAprovadaPatch(item)]))

    setRows(prev => prev.map(item => (
      patchById.has(item.id)
        ? { ...item, ...patchById.get(item.id), raw_data: patchById.get(item.id).raw_data }
        : item
    )))

    const results = await Promise.all(targetRows.map(item => editarFicha(item.id, patchById.get(item.id), user?.id)))
    const failed = results.find(result => result)
    if (failed) {
      setRows(previousRows)
      toast({ type: 'error', title: 'Erro ao mover fichas', message: failed.message || 'Não foi possível concluir a operação.' })
      setSelectedIds([])
      setMoveTarget('')
      return
    }

    toast({ type: 'success', title: `${targetRows.length} ficha${targetRows.length !== 1 ? 's' : ''} retornou${targetRows.length !== 1 ? 'aram' : ''} para Aprovadas` })
    setSelectedIds([])
    setMoveTarget('')
  }

  function openConfirmarCobranca() {
    if (selectedRows.length === 0) {
      toast({ type: 'info', title: 'Selecione pelo menos uma ficha', message: 'Use a seleção do card ou o botão Todos da coluna Aprovadas.' })
      return
    }

    if (!canConfirmCobranca) {
      toast({ type: 'info', title: 'Selecione apenas fichas aprovadas', message: 'Para enviar cobrança, escolha cards da coluna Aprovadas e confirme o envio.' })
      return
    }

    setPendingCobranca({
      ids: selectedRows.map(item => item.id),
      fichas: selectedRows,
    })
  }

  async function handleConfirmarCobranca() {
    if (!pendingCobranca?.fichas?.length) return

    setSalvandoCobranca(true)
    const sentAt = new Date().toISOString()
    const previousRows = rows
    const patchById = new Map(
      pendingCobranca.fichas.map(item => [item.id, buildCobrancaPatch(item, sentAt)]),
    )

    setRows(prev => prev.map(item => (
      patchById.has(item.id)
        ? { ...item, ...patchById.get(item.id), raw_data: patchById.get(item.id).raw_data }
        : item
    )))

    const results = await Promise.all(
      pendingCobranca.fichas.map(item => editarFicha(item.id, patchById.get(item.id), user?.id)),
    )
    const failed = results.find(result => result)

    setSalvandoCobranca(false)
    if (failed) {
      setRows(previousRows)
      toast({ type: 'error', title: 'Erro ao registrar cobrança', message: failed.message || 'Não foi possível salvar o envio de cobrança.' })
      return
    }

    toast({ type: 'success', title: `${pendingCobranca.fichas.length} cobrança${pendingCobranca.fichas.length !== 1 ? 's' : ''} registrada${pendingCobranca.fichas.length !== 1 ? 's' : ''}` })
    setPendingCobranca(null)
    setSelectedIds([])
    setMoveTarget('')
  }

  async function toggleCobrancaEnviadaLinha(ficha, colunaId, nextValue) {
    const patch = colunaId === 'recuperados'
      ? buildCobrancaHistoricoPatch(ficha, nextValue)
      : buildAprovadaPatch(ficha)

    const previousRows = rows
    setRows(prev => prev.map(item => (
      item.id === ficha.id ? { ...item, ...patch, raw_data: patch.raw_data } : item
    )))

    const err = await editarFicha(ficha.id, patch, user?.id)
    if (err) {
      setRows(previousRows)
      toast({ type: 'error', title: 'Erro ao atualizar cobranca', message: err.message })
      return
    }
    toast({
      type: 'success',
      title: colunaId === 'recuperados'
        ? 'Histórico de cobrança atualizado'
        : (nextValue ? 'Marcado como cobrança enviada' : 'Ficha retornou para Aprovadas'),
    })
  }

  async function toggleImobiliariaRetornou(ficha, nextValue) {
    const patch = buildImobiliariaRetornoPatch(ficha, nextValue)

    const previousRows = rows
    setRows(prev => prev.map(item => (
      item.id === ficha.id ? { ...item, raw_data: patch.raw_data } : item
    )))

    const err = await editarFicha(ficha.id, patch, user?.id)
    if (err) {
      setRows(previousRows)
      toast({ type: 'error', title: 'Erro ao atualizar retorno da imobiliária', message: err.message })
      return
    }
    toast({ type: 'success', title: nextValue ? 'Imobiliária marcada como retornou' : 'Marcação de retorno removida' })
  }

  function openFinalizarRelatorio() {
    if (periodo !== 'mes') {
      toast({ type: 'info', title: 'Fechamento mensal disponível apenas para a visão de mês.' })
      return
    }

    setPendingFinalizacao({
      periodoLabel,
      scopeKey: periodoScopeKey,
      resumo: resumoFinalizacao,
    })
  }

  function openPendenciaImobiliaria(nomeImobiliaria, focusSectionId) {
    const selectedImob = imobiliarias.find(item => normalizeKey(item.nome_canonico) === normalizeKey(nomeImobiliaria))
    if (!selectedImob?.id) {
      toast({ type: 'error', title: 'Imobiliária não encontrada', message: 'Não foi possível abrir o relatório individual desta imobiliária.' })
      return
    }

    setPendingFinalizacao(null)
    openImobiliariaReport(selectedImob.id, { focusSectionId })
  }

  function onClickAlertaTopo() {

    if (!alertaTopo) return

    if (alertaTopo.tipo === 'danger' && alertaTopo.periodoAnterior) {
      updateQuery({ periodo: 'mes', ano: alertaTopo.periodoAnterior.ano, mes: alertaTopo.periodoAnterior.mes })
      return
    }

    if (alertaTopo.detalhe) {
      setAlertaRelatorioDetalhe(alertaTopo)
    }
  }

  async function handleConfirmarEmissao(payload) {
    if (!pendingEmissao) return
    setSalvandoEmissao(true)

    const recoveryStart = getRecoveryStart(pendingEmissao.ficha)
    const wasInCobranca = Boolean(recoveryStart)

    const { error } = await registrarApoliceDaFicha({
      ficha: pendingEmissao.ficha,
      proprietarioNome: payload.proprietarioNome,
      proprietarioCel: payload.proprietarioCel,
      numeroApolice: payload.numeroApolice,
      numeroProposta: payload.numeroProposta,
      endereco: payload.endereco,
      seguradora: payload.seguradora,
      inicioVigencia: payload.inicioVigencia,
      fimVigencia: payload.fimVigencia,
      parcelamento: payload.parcelamento,
      valorParcela: payload.valorParcela,
      premioLiquido: payload.premioLiquido,
      pctComissao: payload.pctComissao,
      pctDesconto: payload.pctDesconto,
      formaPagamento: payload.formaPagamento,
      emitidoPor: payload.emitidoPor,
    })

    if (!error && wasInCobranca) {
      await editarFicha(pendingEmissao.ficha.id, {
        raw_data: {
          ...(pendingEmissao.ficha.raw_data || {}),
          recovered_after_cobranca: true,
          recovered_after_cobranca_em: new Date().toISOString(),
        },
      }, user?.id)
    }

    setSalvandoEmissao(false)
    if (error) {
      toast({ type: 'error', title: 'Erro ao registrar emissão', message: error.message })
      setPendingEmissao(null)
      return
    }

    toast({ type: 'success', title: wasInCobranca ? 'Emissão recuperada registrada' : 'Emissão registrada' })
    setPendingEmissao(null)
    setRows(prev => prev.map(item => (
      item.id === pendingEmissao.ficha.id
        ? {
            ...item,
            status: 'emitido',
            numero_apolice: payload.numeroApolice,
            seguradora: payload.seguradora,
            data_emissao: new Date().toISOString().slice(0, 10),
            _hasEmittedPolicy: true,
            _effectiveNumeroApolice: payload.numeroApolice,
            _effectiveSeguradora: payload.seguradora,
            _effectiveDataEmissao: new Date().toISOString().slice(0, 10),
            raw_data: {
              ...(item.raw_data || {}),
              recovered_after_cobranca: wasInCobranca,
              recovered_after_cobranca_em: wasInCobranca ? new Date().toISOString() : null,
            },
          }
        : item
    )))
  }

  const emptyCopy = !loading && rows.length === 0

  const topImobiliariasAprovadas = useMemo(() => {
    return [...groupedByImob]
      .sort((a, b) => b.aprovadas - a.aprovadas)
      .slice(0, 10)
      .map(item => ({ name: item.nome, value: item.aprovadas }))
  }, [groupedByImob])

  const topImobiliariasEmitidas = useMemo(() => {
    return [...groupedByImob]
      .sort((a, b) => b.emitidas - a.emitidas)
      .slice(0, 10)
      .map(item => ({ name: item.nome, value: item.emitidas }))
  }, [groupedByImob])

  const piorConversao = useMemo(() => {
    return [...groupedByImob]
      .filter(item => item.aprovadas > 0)
      .sort((a, b) => a.taxaConversao - b.taxaConversao)
      .slice(0, 10)
      .map(item => ({ name: item.nome, value: Number(item.taxaConversao.toFixed(1)) }))
  }, [groupedByImob])

  const topRecuperacao = useMemo(() => {
    return [...groupedByImob]
      .filter(item => item.recuperadas > 0)
      .sort((a, b) => b.recuperadas - a.recuperadas)
      .slice(0, 10)
      .map(item => ({ name: item.nome, value: item.recuperadas }))
  }, [groupedByImob])

  const eficienciaRows = useMemo(() => {
    return [...groupedByImob]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [groupedByImob])

  const overviewActions = (
    <div className="flex flex-wrap items-center gap-3">
      <PeriodControl
        periodo={periodo}
        ano={ano}
        mes={mes}
        anos={years}
        onPeriod={onChangePeriodo}
        onAno={onChangeAno}
        onMes={onChangeMes}
      />
      {periodo === 'mes' && (
        <button
          type="button"
          onClick={openFinalizarRelatorio}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 hover:bg-red-100"
        >
          <CheckSquare className="h-3.5 w-3.5" /> Finalizar relatório
        </button>
      )}
      {isDetail && (
        <button
          type="button"
          onClick={() => navigate(
            { pathname: '/relatorio', search: location.search },
            {
              replace: false,
              state: typeof location.state?.scrollTopOverview === 'number'
                ? { scrollTop: location.state.scrollTopOverview }
                : undefined,
            },
          )}
          className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Visão geral
        </button>
      )}
    </div>
  )

  const sharedModals = (
    <>
      {pendingFinalizacao && (
        <ModalFinalizarRelatorio
          periodoLabel={pendingFinalizacao.periodoLabel}
          resumo={pendingFinalizacao.resumo}
          salvando={false}
          onCancelar={() => setPendingFinalizacao(null)}
          onAbrirImobiliaria={openPendenciaImobiliaria}
          onConfirmar={() => {
            const now = new Date().toISOString()
            setFinalizacoesMap(prev => ({
              ...(prev || {}),
              [pendingFinalizacao.scopeKey]: {
                finalizedAt: now,
                periodoLabel: pendingFinalizacao.periodoLabel,
                semCobranca: pendingFinalizacao.resumo.semCobranca,
                semRetorno: pendingFinalizacao.resumo.semRetorno,
              },
            }))
            setPendingFinalizacao(null)
            toast({
              type: pendingFinalizacao.resumo.semCobranca.length > 0 ? 'warning' : 'success',
              title: 'Relatório finalizado',
              message: pendingFinalizacao.resumo.semRetorno.length > 0
                ? 'Há imobiliárias aguardando retorno para o próximo mês.'
                : 'Fechamento mensal registrado com sucesso.',
            })
          }}
        />
      )}
      {alertaRelatorioDetalhe && (
        <ModalResumoRelatorio
          titulo={alertaRelatorioDetalhe.titulo}
          descricao={alertaRelatorioDetalhe.descricao}
          secaoEnvio={alertaRelatorioDetalhe.detalhe?.semCobranca || []}
          secaoRetorno={alertaRelatorioDetalhe.detalhe?.semRetorno || []}
          onFechar={() => setAlertaRelatorioDetalhe(null)}
        />
      )}
    </>
  )

  if (loading) {
    return (
      <div className="relatorio-page space-y-5 animate-fade-in">
        <PageHeader
          eyebrow="Relatórios operacionais"
          title={isDetail ? 'Relatório por Imobiliária' : 'Relatórios Fiança'}
          description="Carregando dados do painel..."
          actions={overviewActions}
        />
        <DataCard className="py-16 text-center">
          <div className="flex items-center justify-center gap-2 text-dark-muted text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando relatórios...
          </div>
        </DataCard>
      </div>
    )
  }

  if (isDetail) {
    const currentImob = imobiliarias.find(item => String(item.id) === String(imobiliariaId))
    const title = currentImob?.nome_canonico || 'Imobiliária'
    const logoMeta = currentImob ? getEntityImageUrl(currentImob.imagem_path, currentImob.imagem_url) : null

    return (
      <div className="relatorio-page space-y-5 animate-fade-in">
        {!loading && alertaTopo && (
          <button
            type="button"
            onClick={onClickAlertaTopo}
            className={`w-full rounded-[28px] border px-5 py-4 text-left shadow-sm transition-colors ${alertaTopo.tipo === 'warning' ? 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100' : 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{alertaTopo.titulo}</p>
                <p className="mt-1 text-xs opacity-90">{alertaTopo.descricao}</p>
              </div>
              <span className="rounded-full border border-current/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                {alertaTopo.tipo === 'warning' ? 'Ver imobiliárias' : 'Abrir mês anterior'}
              </span>
            </div>
          </button>
        )}

        <PageHeader
          eyebrow="Relatórios operacionais"
          title={title}
          description={`Painel analítico da imobiliária em ${periodoLabel}, organizado por blocos.`}
          actions={overviewActions}
          stats={
            <>
              <MetricCard label="Fichas aprovadas" value={summary.fichasAprovadas} tone="accent" icon={<LayoutGrid className="h-4 w-4" />} />
              <MetricCard label="Sem cobrança enviada" value={summary.semCobrancaEnviada} tone="success" icon={<CheckSquare className="h-4 w-4" />} />
              <MetricCard label="Aguardando retorno" value={summary.aguardandoRetorno} tone="warning" icon={<MoveRight className="h-4 w-4" />} />
              <MetricCard label="Apólices emitidas" value={summary.emitidas} tone="secondary" icon={<ShieldCheck className="h-4 w-4" />} />
              <MetricCard label="Emitidas sem ficha" value={summary.emitidasSemFichaVinculada} tone="warning" icon={<FileText className="h-4 w-4" />} />
              <MetricCard label="Expiradas" value={summary.expiradas} tone="accent" icon={<Square className="h-4 w-4" />} />
              <MetricCard label="Recuperadas" value={summary.recuperadas} tone="warning" icon={<MoveRight className="h-4 w-4" />} />
            </>
          }
        />

        <SelectedToolbar
          count={selectedIds.length}
          onClear={clearSelection}
          onSelectAll={selectAllVisible}
          onInvertSelection={invertSelection}
          onMove={moveSelected}
          onBulkCopy={copySelected}
          onConfirmCobranca={openConfirmarCobranca}
          canConfirmCobranca={canConfirmCobranca}
          pendingCobrancaCount={pendingCobrancaCount}
          options={MANUAL_REPORT_MOVE_OPTIONS}
          target={moveTarget}
          setTarget={setMoveTarget}
        />

        <DataCard
          title="Filtros"
          subtitle="Use mês, ano ou histórico. O histórico do Kanban é salvo por imobiliária e período."
          actions={<span className="badge badge-info">{periodoLabel}</span>}
        >
          <PeriodControl
            periodo={periodo}
            ano={ano}
            mes={mes}
            anos={years}
            onPeriod={onChangePeriodo}
            onAno={onChangeAno}
            onMes={onChangeMes}
          />
        </DataCard>

        <div className="space-y-4">
          {COLUNAS.map(coluna => (
            <div
              key={coluna.id}
              id={`relatorio-coluna-${coluna.id}`}
              ref={element => {
                if (element) columnSectionRefs.current[coluna.id] = element
              }}
              className={`scroll-mt-24 rounded-[30px] transition-all duration-500 ${focusedSectionId === coluna.id ? 'ring-2 ring-brand-primary/25 shadow-[0_0_0_10px_rgba(34,71,170,0.08)]' : ''}`}
            >
              <BlocoRelatorio
                coluna={coluna}
                fichas={columnMap[coluna.id] || []}
                onOpen={openFicha}
                onOpenPolicy={openApolice}
                selectedIds={new Set(selectedIds)}
                onToggleSelect={toggleSelected}
                onCopy={copyColumn}
                onSelectAll={selectAllColumn}
                onConfirmCobranca={openConfirmarCobranca}
                canConfirmCobranca={canConfirmCobranca}
                pendingCobrancaCount={pendingCobrancaCount}
                onToggleCobranca={toggleCobrancaEnviadaLinha}
                onToggleRetornou={toggleImobiliariaRetornou}
              />
            </div>
          ))}
        </div>


        {pendingEmissao && (
          <ModalEmitirApolice
            ficha={pendingEmissao.ficha}
            salvando={salvandoEmissao}
            onCancelar={() => !salvandoEmissao && setPendingEmissao(null)}
            onConfirmar={handleConfirmarEmissao}
          />
        )}
        {pendingCobranca && (
          <ModalConfirmarCobranca
            fichas={pendingCobranca.fichas}
            salvando={salvandoCobranca}
            onCancelar={() => !salvandoCobranca && setPendingCobranca(null)}
            onConfirmar={handleConfirmarCobranca}
          />
        )}

        {sharedModals}
      </div>
    )
  }

  return (
    <div className="relatorio-page space-y-5 animate-fade-in">
      {!loading && alertaTopo && (
        <button
          type="button"
          onClick={onClickAlertaTopo}
          className={`w-full rounded-[28px] border px-5 py-4 text-left shadow-sm transition-colors ${alertaTopo.tipo === 'warning' ? 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100' : 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100'}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{alertaTopo.titulo}</p>
              <p className="mt-1 text-xs opacity-90">{alertaTopo.descricao}</p>
            </div>
            <span className="rounded-full border border-current/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
              {alertaTopo.tipo === 'warning' ? 'Ver imobiliárias' : 'Abrir mês anterior'}
            </span>
          </div>
        </button>
      )}

      <PageHeader
        eyebrow="Relatórios operacionais"
        title="Relatórios Fiança"
        description={`Painel analítico do período ${periodoLabel}. Acompanhe desempenho por imobiliária, seguradora, emissão e recuperação após cobrança.`}
        actions={overviewActions}
      />

      <DataCard
        title="Métricas do período"
        subtitle="Leitura executiva do recorte selecionado."
        className="border-brand-secondary/20 shadow-[0_20px_48px_rgba(15,23,42,0.08)]"
      >
        <div className="relatorio-metrics-grid grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <MetricCard label="Fichas aprovadas" value={summary.fichasAprovadas} tone="accent" icon={<LayoutGrid className="h-4 w-4" />} />
          <MetricCard label="Apólices emitidas" value={summary.emitidas} tone="secondary" icon={<ShieldCheck className="h-4 w-4" />} />
          <MetricCard label="Taxa de emissão" value={`${summary.taxaEmissao.toFixed(1)}%`} tone="accent" icon={<BarChart2 className="h-4 w-4" />} />
          <MetricCard label="Aguardando retorno" value={summary.aguardandoRetorno} tone="warning" icon={<MoveRight className="h-4 w-4" />} />
          <MetricCard label="Sem cobrança enviada" value={summary.semCobrancaEnviada} tone="success" icon={<BellRing className="h-4 w-4" />} />
          <MetricCard label="Emitidas sem ficha" value={summary.emitidasSemFichaVinculada} tone="warning" icon={<FileText className="h-4 w-4" />} />
          <MetricCard label="Recuperadas" value={summary.recuperadas} tone="success" icon={<CheckSquare className="h-4 w-4" />} />
          <MetricCard label="Expiradas" value={summary.expiradas} tone="secondary" icon={<Square className="h-4 w-4" />} />
        </div>
      </DataCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Taxa de emissão" value={`${summary.taxaEmissao.toFixed(1)}%`} hint="Apólices emitidas com ficha vinculada sobre fichas aprovadas" />
        <MetricCard label="Tempo médio até emissão" value={summary.mediaEmissao != null ? `${summary.mediaEmissao.toFixed(1)} dias` : '—'} hint="Entre criação da ficha e emissão" />
        <MetricCard label="Tempo médio em cobrança" value={summary.mediaCobranca != null ? `${summary.mediaCobranca.toFixed(1)} dias` : '—'} hint="Entre cobrança e emissão/atual" />
      </div>

      <DataCard title="Aprovações por seguradora" subtitle="Identifica onde existem aprovações pendentes de emissão.">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 items-stretch">
          {seguradoras.map(seg => {
            const approved = rowsWithHelpers.filter(item => matchesSeguradora(item, seg) && isApprovedFicha(item)).length
            const pending = rowsWithHelpers.filter(item => matchesSeguradora(item, seg) && isAguardandoRetorno(item)).length
            return (
              <div key={seg.id} className="h-full rounded-3xl border border-dark-border/60 bg-dark-surface/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <SeguradoraBadge nome={seg.nome} logoUrl={seg.logoUrl} logoPath={seg.logoPath} size="md" />
                  <span className="badge badge-info">{approved} aprovadas</span>
                </div>
                <p className="mt-3 text-xs text-dark-muted">{pending} aguardando retorno da imobiliária</p>
              </div>
            )
          })}
        </div>
      </DataCard>

      <DataCard
        title="Imobiliárias"
        subtitle="Clique em uma imobiliária para abrir o relatório individual."
        className="border-dark-border/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
        actions={
          <div className="relative min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-muted" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nome..."
              className="input w-full pl-9"
            />
          </div>
        }
      >
        <div className="relatorio-imob-grid grid gap-3 sm:grid-cols-2 2xl:grid-cols-3 items-stretch">
          {filteredImobiliarias.map(imob => {
            const meta = resolverImobiliariaInfo(imob.nome_canonico) || imob
            const imobMetrics = groupedByImob.find(item => normalizeKey(item.nome) === normalizeKey(imob.nome_canonico)) || {
              aprovadas: 0,
              emitidas: 0,
              emitidasSemFichaVinculada: 0,
              aguardandoRetorno: 0,
              semCobrancaEnviada: 0,
              recuperadas: 0,
              expiradas: 0,
              aprovadasSemApolice: 0,
            }
            const pendingCount = imobMetrics.aprovadas || 0
            const requiresSend = (imobMetrics.semCobrancaEnviada || 0) > 0
            const toggleKey = `${periodoScopeKey}:${imob.id}`
            const cobrancaDone = Boolean(cobrancaToggleMap?.[toggleKey])
            const hasPending = pendingCount > 0
            const cardClass = requiresSend
              ? 'group rounded-[28px] border border-red-300 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(254,226,226,0.92))] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-red-400 hover:shadow-[0_18px_36px_rgba(220,38,38,0.18)] shadow-[0_16px_34px_rgba(220,38,38,0.12)]'
              : cobrancaDone && hasPending
                ? 'group rounded-[28px] border border-orange-300 bg-[linear-gradient(180deg,rgba(255,247,237,0.98),rgba(254,215,170,0.35))] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-[0_18px_36px_rgba(249,115,22,0.18)] shadow-[0_16px_34px_rgba(249,115,22,0.12)]'
                : hasPending
                  ? 'group rounded-[28px] border border-brand-accent/30 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.88))] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-accent/50 hover:shadow-[0_18px_36px_rgba(34,71,170,0.16)] shadow-[0_16px_34px_rgba(34,71,170,0.10)]'
                  : 'group rounded-[28px] border border-dark-border/60 bg-dark-surface/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-accent/40 hover:shadow-sm'
            return (
              <div
                key={imob.id}
                role="button"
                tabIndex={0}
                onClick={() => openImobiliariaReport(imob.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openImobiliariaReport(imob.id)
                  }
                }}
                className={cardClass}
              >
                <div className="flex items-start justify-between gap-3">
                  <ImobiliariaIdentity
                    nome={imob.nome_canonico}
                    imagemUrl={meta.imagem_url}
                    imagemPath={meta.imagem_path}
                    size="md"
                  />
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation()
                      const nextValue = !cobrancaDone
                      setCobrancaToggleMap(prev => {
                        const next = { ...(prev || {}), [toggleKey]: nextValue }
                        try { localStorage.setItem(COBRANCA_TOGGLE_STORAGE, JSON.stringify(next)) } catch {}
                        return next
                      })
                    }}
                    className={cobrancaDone
                      ? 'inline-flex items-center gap-2 rounded-full border border-orange-300 bg-orange-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-800'
                      : 'inline-flex items-center gap-2 rounded-full border border-dark-border/70 bg-dark-surface/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted hover:border-brand-accent/35 hover:text-dark-text'}
                    aria-pressed={cobrancaDone}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${cobrancaDone ? 'bg-orange-500' : 'bg-slate-300'}`} />
                    Cobrado todos
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${imob.ativa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                    {imob.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                  {requiresSend && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-700">
                      <AlertTriangle className="h-3 w-3" /> Enviar cobrança imob
                    </span>
                  )}
                  {!requiresSend && cobrancaDone && hasPending && (
                    <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold text-orange-700">
                      Cobrado todos
                    </span>
                  )}
                  {!requiresSend && hasPending && (
                    <span className="inline-flex rounded-full bg-dark-surface/85 px-2.5 py-1 text-[10px] font-semibold text-dark-text shadow-sm">
                      Pendências: {pendingCount}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                  <div className="rounded-2xl bg-dark-surface/70 px-3 py-2">
                    <p className="text-dark-muted">Aprovadas</p>
                    <p className="mt-1 text-sm font-semibold text-dark-text">{imobMetrics.aprovadas}</p>
                  </div>
                  <div className="rounded-2xl bg-dark-surface/70 px-3 py-2">
                    <p className="text-dark-muted">Cobrança</p>
                    <p className="mt-1 text-sm font-semibold text-dark-text">{imobMetrics.aguardandoRetorno}</p>
                  </div>
                  <div className="rounded-2xl bg-dark-surface/70 px-3 py-2">
                    <p className="text-dark-muted">Emitidas</p>
                    <p className="mt-1 text-sm font-semibold text-dark-text">{imobMetrics.emitidas}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">Prioridade operacional</span>
                    <span className={requiresSend ? 'text-xs font-semibold text-red-700' : cobrancaDone && hasPending ? 'text-xs font-semibold text-orange-700' : hasPending ? 'text-xs font-semibold text-status-info' : 'text-xs font-semibold text-emerald-700'}>
                      {requiresSend ? 'Existem fichas sem cobrança enviada' : cobrancaDone && hasPending ? 'Todas as cobranças foram enviadas' : hasPending ? 'Fichas aguardando retorno' : 'Operação em dia'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-dark-muted transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            )
          })}
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Top 10 - Mais aprovaram"
          subtitle="Quantidade de fichas aprovadas."
          data={topImobiliariasAprovadas}
          dataKey="value"
          xKey="name"
          color="#0f766e"
        />
        <ChartCard
          title="Top 10 - Mais emitiram"
          subtitle="Quantidade de apólices emitidas."
          data={topImobiliariasEmitidas}
          dataKey="value"
          xKey="name"
          color="#000079"
        />
        <ChartCard
          title="Menor conversão"
          subtitle="Menor emissão sobre aprovadas."
          data={piorConversao}
          dataKey="value"
          xKey="name"
          color="#a2d6da"
          formatter={value => `${Number(value).toFixed(1)}%`}
        />
        <ChartCard
          title="Recuperação após cobrança"
          subtitle="Imobiliárias que mais recuperam emissões."
          data={topRecuperacao}
          dataKey="value"
          xKey="name"
          color="#4b6cc2"
        />
      </div>

      <DataCard title="Ranking de eficiência" subtitle="Pontuação baseada em aprovação, conversão, recuperação e velocidade.">
        <div className="space-y-2">
          {eficienciaRows.map((row, index) => (
            <div key={row.nome} className="flex items-center justify-between rounded-2xl border border-dark-border/50 bg-dark-surface/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary/10 text-xs font-bold text-brand-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-dark-text">{row.nome}</p>
                  <p className="text-[11px] text-dark-muted">{row.aprovadas} aprovadas · {row.emitidas} emitidas · {row.recuperadas} recuperadas</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-dark-text">{row.score.toFixed(1)}</p>
                <p className="text-[11px] text-dark-muted">score</p>
              </div>
            </div>
          ))}
        </div>
      </DataCard>

      {emptyCopy && (
        <EmptyState
          icon={BarChart2}
          title="Nenhuma ficha encontrada"
          description={`Não há registros para ${periodoLabel}. Ajuste o período ou escolha outra imobiliária.`}
        />
      )}

      {sharedModals}
    </div>
  )
}








