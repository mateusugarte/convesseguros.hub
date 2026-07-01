import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  BarChart2,
  ChevronLeft,
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
import { PageHeader, MetricCard, DataCard, Select, Avatar } from '../components/ui'
import SeguradoraBadge from '../components/SeguradoraBadge'
import ImobiliariaIdentity from '../components/ImobiliariaIdentity'
import FichaStatusBadge from '../components/FichaStatusBadge'
import { normalizeDisplayText } from '../lib/text'
import { getEntityImageUrl } from '../lib/entityMedia'
import { getFichaOperationalState } from '../lib/fichaOperational'
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../lib/kanbanDnd'
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
const STORAGE_PREFIX = 'relatorio-fian-ca-scroll'
const COBRANCA_TOGGLE_STORAGE = 'relatorio-cobranca-toggle'

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

function formatDateTimeBR(value) {
  if (!value) return null
  try {
    return format(parseISO(String(value)), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return String(value)
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
  return ficha?.raw_data?.retorno_enviado_em || ficha?.raw_data?.cobranca_started_at || null
}


function isRecovered(ficha) {
  return Boolean(ficha?.raw_data?.recovered_after_cobranca)
}

function isInCobrança(ficha) {
  return getColuna(ficha) === 'enviado_cobranca'
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

function summarizeRows(rows) {
  const summary = {
    total: rows.length,
    aprovadas: 0,
    emitidas: 0,
    cobranca: 0,
    recuperadas: 0,
    expiradas: 0,
    aprovadasSemApolice: 0,
    tempoEmissao: [],
    tempoCobrança: [],
  }

  rows.forEach(ficha => {
    const coluna = getColuna(ficha)
    if (coluna === 'aprovada') summary.aprovadas += 1
    if (coluna === 'expirada') summary.expiradas += 1
    if (isInCobrança(ficha)) summary.cobranca += 1
    if (isRecovered(ficha)) summary.recuperadas += 1
    if (isEmitida(ficha)) summary.emitidas += 1
    if ((coluna === 'aprovada' || coluna === 'enviado_cobranca') && !isEmitida(ficha)) summary.aprovadasSemApolice += 1

    if (ficha._hasEmittedPolicy && getEffectiveDataEmissao(ficha) && ficha.created_at) {
      const start = new Date(ficha.created_at)
      const end = new Date(getEffectiveDataEmissao(ficha))
      const days = (end - start) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) summary.tempoEmissao.push(days)
    }

    const cobrançaStart = getRecoveryStart(ficha)
    if (cobrançaStart) {
      const start = new Date(cobrançaStart)
      const end = ficha?.raw_data?.recovered_after_cobranca_em
        ? new Date(ficha.raw_data.recovered_after_cobranca_em)
        : new Date()
      const days = (end - start) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) summary.tempoCobrança.push(days)
    }
  })

  summary.totalFichas = summary.aprovadas
  summary.fichasAprovadas = summary.aprovadas
  summary.taxaEmissao = summary.aprovadas > 0 ? (summary.emitidas / summary.aprovadas) * 100 : 0
  summary.taxaRecuperacao = summary.cobranca > 0 ? (summary.recuperadas / summary.cobranca) * 100 : 0
  summary.mediaEmissao = summary.tempoEmissao.length
    ? summary.tempoEmissao.reduce((a, b) => a + b, 0) / summary.tempoEmissao.length
    : null
  summary.mediaCobrança = summary.tempoCobrança.length
    ? summary.tempoCobrança.reduce((a, b) => a + b, 0) / summary.tempoCobrança.length
    : null

  return summary
}

function groupByImobiliaria(rows, resolverNome) {
  const map = new Map()

  rows.forEach(ficha => {
    const key = getCanonicalImobiliariaNome(ficha) || resolverNome(ficha.imobiliaria || '—')
    const current = map.get(key) || {
      nome: key,
      total: 0,
      aprovadas: 0,
      emitidas: 0,
      recuperadas: 0,
      cobranca: 0,
      expiradas: 0,
      mediaEmissao: null,
      mediaCobrança: null,
      logoUrl: null,
      logoPath: null,
      aprovadasSemApolice: 0,
      tempoEmissao: [],
      tempoCobrança: [],
    }

    const coluna = getColuna(ficha)
    current.total += 1
    if (coluna === 'aprovada') current.aprovadas += 1
    if (coluna === 'expirada') current.expiradas += 1
    if ((coluna === 'aprovada' || coluna === 'enviado_cobranca') && !isEmitida(ficha)) current.aprovadasSemApolice += 1
    if (isEmitida(ficha)) current.emitidas += 1
    if (isRecovered(ficha)) current.recuperadas += 1
    if (isInCobrança(ficha)) current.cobranca += 1

    if (ficha._hasEmittedPolicy && getEffectiveDataEmissao(ficha) && ficha.created_at) {
      const days = (new Date(getEffectiveDataEmissao(ficha)) - new Date(ficha.created_at)) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) current.tempoEmissao.push(days)
    }

    const cobrançaStart = getRecoveryStart(ficha)
    if (cobrançaStart) {
      const end = ficha?.raw_data?.recovered_after_cobranca_em
        ? new Date(ficha.raw_data.recovered_after_cobranca_em)
        : new Date()
      const days = (end - new Date(cobrançaStart)) / (1000 * 60 * 60 * 24)
      if (Number.isFinite(days) && days >= 0) current.tempoCobrança.push(days)
    }

    map.set(key, current)
  })

  return [...map.values()].map(item => ({
    ...item,
    taxaConversao: item.aprovadas > 0 ? (item.emitidas / item.aprovadas) * 100 : 0,
    taxaRecuperacao: item.cobranca > 0 ? (item.recuperadas / item.cobranca) * 100 : 0,
    score:
      ((item.aprovadas > 0 ? (item.aprovadas / Math.max(item.total, 1)) : 0) * 35) +
      ((item.emitidas > 0 && item.aprovadas > 0 ? (item.emitidas / item.aprovadas) : 0) * 35) +
      ((item.cobranca > 0 ? (item.recuperadas / item.cobranca) : 0) * 20) -
      ((item.tempoEmissao.length ? item.tempoEmissao.reduce((a, b) => a + b, 0) / item.tempoEmissao.length : 0) * 2),
    mediaEmissao: item.tempoEmissao.length ? item.tempoEmissao.reduce((a, b) => a + b, 0) / item.tempoEmissao.length : null,
    mediaCobrança: item.tempoCobrança.length ? item.tempoCobrança.reduce((a, b) => a + b, 0) / item.tempoCobrança.length : null,
  })).sort((a, b) => b.score - a.score)
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
      <div className="h-72">
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

function RelatorioCard({ ficha, onOpen, onOpenPolicy, selected, onToggleSelect, dragListeners, dragAttributes, selectionMode }) {
  const nome = getNomeFicha(ficha)
  const doc = getDocumento(ficha)
  const op = getOperacionalStatus(ficha)
  const cobrancaSentAt = getRecoveryStart(ficha)
  const prodColor = ficha.produto === 'pessoa_juridica' ? '#4b6cc2' : ficha.produto === 'comercial_pf' ? '#0f766e' : '#000079'
  const isEmissaoCard = isEmitida(ficha)
  const cardVisual = op?.id === 'aprovada'
    ? { background: 'linear-gradient(180deg, rgba(236,253,245,0.98), rgba(220,252,231,0.92))', border: '1px solid rgba(15,118,110,0.24)', shadow: '0 18px 36px rgba(15,118,110,0.12)' }
    : op?.id === 'enviado_cobranca'
      ? { background: 'linear-gradient(180deg, rgba(239,246,255,0.98), rgba(219,234,254,0.92))', border: '1px solid rgba(34,71,170,0.26)', shadow: '0 18px 36px rgba(34,71,170,0.12)' }
      : isEmissaoCard
        ? { background: 'linear-gradient(180deg, rgba(238,242,255,0.98), rgba(224,231,255,0.94))', border: '1px solid rgba(0,0,121,0.22)', shadow: '0 18px 36px rgba(0,0,121,0.12)' }
        : op?.id === 'expirada'
          ? { background: 'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(226,232,240,0.94))', border: '1px solid rgba(100,116,139,0.24)', shadow: '0 18px 36px rgba(100,116,139,0.10)' }
          : { background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))', border: '1px solid rgba(148,163,184,0.20)', shadow: '0 16px 32px rgba(15,23,42,0.08)' }

  return (
    <div
      {...(!selectionMode && dragListeners ? dragListeners : {})}
      {...(!selectionMode && dragAttributes ? dragAttributes : {})}
      className={`kanban-card relative ${selected ? 'ring-2 ring-brand-accent' : ''}`}
      style={{ '--kanban-accent': prodColor, cursor: selectionMode ? 'pointer' : 'grab', background: cardVisual.background, border: cardVisual.border, boxShadow: cardVisual.shadow }}
      onClick={() => (selectionMode ? onToggleSelect(ficha.id) : onOpen(ficha.id))}
    >
      <div className="kanban-card-body">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onToggleSelect(ficha.id) }}
              className="rounded-lg p-1 hover:bg-dark-surface2"
              aria-label="Selecionar card"
            >
              {selected ? <CheckSquare className="h-4 w-4 text-brand-primary" /> : <Square className="h-4 w-4 text-dark-muted" />}
            </button>
            <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: `${prodColor}20`, color: prodColor }}>
              {normalizeDisplayText(ficha.produto) || ficha.produto || 'Fiança'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-dark-muted">{formatDateBR(ficha.created_at)}</span>
        </div>

        <div className="space-y-1.5">
          <p className="text-[12.5px] font-semibold leading-snug text-dark-text">{nome}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">{getCanonicalImobiliariaNome(ficha) || 'Imobiliária não informada'}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <FichaStatusBadge ficha={ficha} />
          {doc && (
            <span className="rounded-full border border-dark-border/60 bg-dark-surface2/70 px-2 py-1 text-[10px] font-mono text-dark-muted">
              {doc}
            </span>
          )}
          {getEffectiveNumeroApolice(ficha) && (
            <span className="rounded-full px-2 py-1 text-[10px] font-mono" style={{ background: '#2247aa15', color: '#2247aa' }}>
              Apólice: {getEffectiveNumeroApolice(ficha)}
            </span>
          )}
        </div>

        {op && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-dark-border/50 pt-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Status operacional</p>
              <span className={`badge ${op.color}`}>{op.label}</span>
            </div>
          </div>
        )}

        {op?.id === 'enviado_cobranca' && cobrancaSentAt && (
          <div className="mt-2 rounded-2xl border border-brand-accent/15 bg-brand-accent/5 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-status-info">Cobran?a enviada</p>
            <p className="mt-1 text-[11px] text-dark-text">{formatDateTimeBR(cobrancaSentAt) || formatDateBR(cobrancaSentAt)}</p>
          </div>
        )}

        {isEmissaoCard && !selectionMode && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dark-border/50 pt-3">
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onOpen(ficha.id) }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dark-border/60 bg-dark-surface/85 px-2.5 py-2 text-[10px] font-semibold text-dark-text transition-colors hover:border-brand-accent/45 hover:text-status-info"
            >
              <FileText className="h-3.5 w-3.5" /> Abrir ficha
            </button>
            <button
              type="button"
              disabled={!ficha?._apolice?.id}
              onClick={event => { event.stopPropagation(); if (ficha?._apolice?.id) onOpenPolicy?.(ficha._apolice.id) }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-2.5 py-2 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir apolice
            </button>
          </div>
        )}

        {ficha.observacoes && (
          <p className="mt-2 line-clamp-2 text-[11px] text-dark-muted">{ficha.observacoes}</p>
        )}
      </div>
    </div>
  )
}

function DraggableRelatorioCard({ ficha, onOpen, onOpenPolicy, selected, onToggleSelect, selectionMode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ficha.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.2 : 1,
        touchAction: 'none',
        transition: isDragging ? 'none' : 'opacity 0.15s ease',
      }}
    >
      <RelatorioCard
        ficha={ficha}
        onOpen={onOpen}
        onOpenPolicy={onOpenPolicy}
        selected={selected}
        onToggleSelect={onToggleSelect}
        dragListeners={listeners}
        dragAttributes={attributes}
        selectionMode={selectionMode}
      />
    </div>
  )
}

function KanbanColuna({
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
  selectionMode,
  colIndex,
}) {
  const { isOver, setNodeRef } = useDroppable({ id: coluna.id })

  return (
    <div className="kanban-col animate-fade-in flex flex-col" style={{ animationDelay: `${colIndex * 40}ms`, animationFillMode: 'both' }}>
      <div
        className="kanban-col-header flex items-center justify-between flex-shrink-0"
        style={{ background: `${coluna.color}18`, borderColor: `${coluna.color}50` }}
      >
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: coluna.color }} />
          <span className="text-[11px] font-semibold" style={{ color: coluna.color }}>{coluna.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: `${coluna.color}25`, color: coluna.color }}>
            {fichas.length}
          </span>
          <button
            type="button"
            onClick={event => { event.stopPropagation(); onSelectAll(coluna.id) }}
            className="rounded-lg border border-dark-border/60 px-2 py-1 text-[10px] font-medium text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
            title="Selecionar todos desta coluna"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={event => { event.stopPropagation(); onCopy(coluna.id) }}
            className="rounded-lg border border-dark-border/60 px-2 py-1 text-[10px] font-medium text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
            title="Copiar informações da coluna"
          >
            Copiar
          </button>
          {coluna.id === 'enviado_cobranca' && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onConfirmCobranca() }}
              disabled={!canConfirmCobranca}
              className="rounded-lg bg-brand-primary px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              title="Registrar envio de cobran?a para as fichas selecionadas"
            >
              Marcar envio{pendingCobrancaCount > 0 ? ` (${pendingCobrancaCount})` : ''}
            </button>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="kanban-col-body flex-1 space-y-1.5 overflow-y-auto p-1.5 transition-colors duration-150"
        style={{
          borderColor: isOver ? `${coluna.color}80` : 'rgb(var(--color-border))',
          backgroundColor: isOver ? `${coluna.color}08` : 'rgb(var(--color-surface2) / 0.4)',
          boxShadow: isOver ? `inset 0 0 0 2px ${coluna.color}40` : 'none',
        }}
      >
        {fichas.length === 0 ? (
          <div className="kanban-empty">
            <Square className="kanban-empty-icon h-5 w-5" />
            <span className="kanban-empty-text">Vazia</span>
          </div>
        ) : (
          fichas.map(ficha => (
            <DraggableRelatorioCard
              key={ficha.id}
              ficha={ficha}
              onOpen={onOpen}
              onOpenPolicy={onOpenPolicy}
              selected={selectedIds.has(ficha.id)}
              onToggleSelect={onToggleSelect}
              selectionMode={selectionMode}
            />
          ))
        )}
      </div>
    </div>
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

function SelectedToolbar({ count, onClear, onSelectAll, onInvertSelection, onMove, onBulkCopy, options, target, setTarget }) {
  return (
    <DataCard className="border-brand-accent/15 bg-brand-accent/5" bodyClassName="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Seleção em massa</p>
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
            <Field label="Número da Apólice" value={numeroApolice} onChange={setNumeroApolice} required />
            <Field label="Número da Proposta" value={numeroProposta} onChange={setNumeroProposta} />
            <div className="sm:col-span-2">
              <Field label="Endereço do Imóvel" value={endereco} onChange={setEndereco} />
            </div>
            <Field type="date" label="Início da Vigência" value={inicioVigencia} onChange={setInicioVigencia} required />
            <Field type="date" label="Fim da Vigência" value={fimVigencia} onChange={setFimVigencia} required />
            <ReadOnly label="Tempo de Vigência" value={meses > 0 ? `${meses} meses` : '—'} />
            <Field type="number" label="Parcelamento (vezes)" value={parcelamento} onChange={setParcelamento} required />
            <Field type="number" label="Valor da Parcela (R$)" value={valorParcela} onChange={setValorParcela} required />
            <Field type="number" label="Prêmio Líquido (R$)" value={premioLiquido} onChange={setPremioLiquido} required />
            <Field type="number" label="% Comissão" value={pctComissao} onChange={setPctComissao} required />
            <Field type="number" label="% Desconto" value={pctDesconto} onChange={setPctDesconto} required />
            <ReadOnly label="Prêmio total" value={premioTotal != null ? formatMoneyBR(premioTotal) : '—'} />
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
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={!salvando ? onCancelar : undefined} />
      <div className="relative glass-modal w-full max-w-xl overflow-hidden border border-dark-border">
        <div className="flex items-center justify-between gap-3 border-b border-dark-border px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Confirmar cobran?a</p>
            <h3 className="mt-1 text-lg font-semibold text-dark-text">
              Registrar envio para {fichas.length} ficha{fichas.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <button onClick={onCancelar} className="text-dark-muted hover:text-dark-text" disabled={salvando}>?</button>
        </div>

        <div className="space-y-4 px-6 py-5">
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

        <div className="flex items-center justify-end gap-2 border-t border-dark-border px-6 py-4">
          <button type="button" onClick={onCancelar} className="btn-secondary" disabled={salvando}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Confirmar envio'}
          </button>
        </div>
      </div>
    </div>
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [moveTarget, setMoveTarget] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [pendingEmissao, setPendingEmissao] = useState(null)
  const [salvandoEmissao, setSalvandoEmissao] = useState(false)
  const [pendingCobranca, setPendingCobranca] = useState(null)
  const [salvandoCobranca, setSalvandoCobranca] = useState(false)
  const [cobrancaToggleMap, setCobrancaToggleMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(COBRANCA_TOGGLE_STORAGE) || '{}')
    } catch {
      return {}
    }
  })
  const scrollRef = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const isDetail = Boolean(imobiliariaId)
  const currentPath = `${location.pathname}${location.search}`
  const scrollKey = `${STORAGE_PREFIX}-${currentPath}`
  const periodoScopeKey = getPeriodoScopeKey(periodo, ano, mes)
  const [rangeStart, rangeEnd] = getReportRange(periodo, ano, mes)
  const periodoLabel = getPeriodoLabel(periodo, ano, mes)

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

        const baseRows = createdRows || []
        const emittedIds = (emittedRangeRows || []).map(item => item.ficha_id).filter(Boolean)
        const allIds = [...new Set([...baseRows.map(item => item.id), ...emittedIds])]

        if (allIds.length === 0) {
          setRows([])
          return
        }

        const finalRows = await fetchAllRows(() => {
          let query = supabase
            .from('fichas')
            .select('id, created_at, finalizada_em, nome_interessado, nome_empresa, cpf, cnpj, cep, imobiliaria, status, produto, retorno_enviado, seguradora, orcamentista_forms, observacoes, raw_data, numero_apolice, data_emissao, valor_aluguel, assumida, orcamentista_id, profiles!orcamentista_id(nome, avatar_url)')
            .in('id', allIds)
            .order('created_at', { ascending: false })

          if (imobiliariaAliases?.length) {
            query = query.in('imobiliaria', imobiliariaAliases)
          }

          return query
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
        toast({ type: 'error', title: 'Erro ao carregar relatórios', message: error.message })
        setRows([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRows()
    return () => { active = false }
  }, [ano, mes, periodo, rangeStart, rangeEnd, imobiliariaId, imobiliarias, getAliases, isDetail, toast])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const stateScroll = Number(location.state?.scrollLeft || 0)
    const saved = stateScroll || Number(sessionStorage.getItem(scrollKey) || 0)
    if (saved > 0) {
      requestAnimationFrame(() => {
        el.scrollLeft = saved
      })
    }
  }, [location.state, scrollKey, rows.length, loading])

  useEffect(() => {
    if (typeof location.state?.scrollTop !== 'number') return
    requestAnimationFrame(() => {
      window.scrollTo({ top: location.state.scrollTop, behavior: 'auto' })
    })
  }, [location.state])

  useEffect(() => {
    localStorage.setItem(COBRANCA_TOGGLE_STORAGE, JSON.stringify(cobrancaToggleMap))
  }, [cobrancaToggleMap])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    const onScroll = () => {
      sessionStorage.setItem(scrollKey, String(el.scrollLeft))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollKey])

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

  const summary = useMemo(() => summarizeRows(rowsWithHelpers), [rowsWithHelpers])
  const groupedByImob = useMemo(() => groupByImobiliaria(rowsWithHelpers, resolverNome), [rowsWithHelpers, resolverNome])
  const groupedByImobMap = useMemo(() => {
    return new Map(groupedByImob.map(item => [normalizeKey(item.nome), item]))
  }, [groupedByImob])

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
  const selectionMode = selectedIds.length > 0
  const activeFicha = activeId ? rowsWithHelpers.find(item => item.id === activeId) : null

  function updateQuery(next) {
    const params = new URLSearchParams(location.search)
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') params.delete(key)
      else params.set(key, String(value))
    })
    navigate({ pathname: isDetail ? `/relatorio/${imobiliariaId}` : '/relatorio', search: params.toString() ? `?${params.toString()}` : '' }, { replace: true })
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
    const scrollLeft = scrollRef.current?.scrollLeft || 0
    navigate(`/fichas/${id}`, {
      state: {
        backTo: currentPath,
        backState: { scrollLeft, scrollTop: window.scrollY },
      },
    })
  }

  function openApolice(id) {
    const scrollLeft = scrollRef.current?.scrollLeft || 0
    navigate(`/apolices/${id}`, {
      state: {
        backTo: currentPath,
        backState: { scrollLeft, scrollTop: window.scrollY },
      },
    })
  }

  function scrollKanban(direction) {
    scrollRef.current?.scrollBy({
      left: direction * 360,
      behavior: 'smooth',
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
    toast({ type: 'success', title: 'Informações copiadas' })
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
    if (moveTarget !== 'aprovada') return

    if (selectedRows.some(item => getColuna(item) !== 'enviado_cobranca')) {
      toast({ type: 'info', title: 'Selecione apenas fichas da coluna Enviado Cobran?a', message: 'O retorno em massa para Aprovadas s? pode ser feito com fichas que j? estavam em cobran?a.' })
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
      toast({ type: 'error', title: 'Erro ao mover fichas', message: failed.message || 'N?o foi poss?vel concluir a opera??o.' })
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
      toast({ type: 'info', title: 'Selecione pelo menos uma ficha', message: 'Use a sele??o do card ou o bot?o Todos da coluna Aprovadas.' })
      return
    }

    if (!canConfirmCobranca) {
      toast({ type: 'info', title: 'Selecione apenas fichas aprovadas', message: 'Para enviar cobran?a, escolha cards da coluna Aprovadas e confirme o envio.' })
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
      toast({ type: 'error', title: 'Erro ao registrar cobran?a', message: failed.message || 'N?o foi poss?vel salvar o envio de cobran?a.' })
      return
    }

    toast({ type: 'success', title: `${pendingCobranca.fichas.length} cobran?a${pendingCobranca.fichas.length !== 1 ? 's' : ''} registrada${pendingCobranca.fichas.length !== 1 ? 's' : ''}` })
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
      toast({ type: 'error', title: 'Erro ao atualizar cobrança', message: err.message })
      return
    }
    toast({ type: 'success', title: nextValue ? 'Marcado como cobrança enviada' : 'Ficha retornou para Aprovadas' })
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

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    const ficha = rowsWithHelpers.find(item => item.id === active.id)
    if (!ficha) return
    const targetCol = over.id
    if (getColuna(ficha) === targetCol) return

    if (targetCol === 'emitida') {
      setPendingEmissao({ fichaId: ficha.id, ficha })
      return
    }

    if (targetCol === 'recuperados') {
      toast({ type: 'info', title: 'Recupera??o depende da emiss?o', message: 'A coluna RECUPERADOS ? preenchida quando a emiss?o ? registrada ap?s cobran?a.' })
      return
    }

    if (targetCol === 'enviado_cobranca') {
      toast({ type: 'info', title: 'Confirma??o obrigat?ria', message: 'Selecione as fichas aprovadas e use "Marcar envio" na coluna Enviado Cobran?a.' })
      return
    }

    const patch = targetCol === 'aprovada' ? buildAprovadaPatch(ficha) : null

    if (!patch) return

    const previousRows = rows
    setRows(prev => prev.map(item => (
      item.id === ficha.id
        ? { ...item, ...patch, raw_data: patch.raw_data }
        : item
    )))

    const err = await editarFicha(ficha.id, patch, user?.id)
    if (err) {
      setRows(previousRows)
      toast({ type: 'error', title: 'Erro ao mover ficha', message: err.message })
    } else {
      toast({ type: 'success', title: 'Ficha movida' })
    }
  }

  async function handleConfirmarEmissao(payload) {
    if (!pendingEmissao) return
    setSalvandoEmissao(true)

    const recoveryStart = getRecoveryStart(pendingEmissao.ficha)
    const wasInCobrança = Boolean(pendingEmissao.ficha?.retorno_enviado || recoveryStart)

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

    if (!error && wasInCobrança) {
      await editarFicha(pendingEmissao.ficha.id, {
        retorno_enviado: false,
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

    toast({ type: 'success', title: wasInCobrança ? 'Emissão recuperada registrada' : 'Emissão registrada' })
    setPendingEmissao(null)
    setRows(prev => prev.map(item => (
      item.id === pendingEmissao.ficha.id
        ? {
            ...item,
            status: 'emitido',
            retorno_enviado: false,
            numero_apolice: payload.numeroApolice,
            seguradora: payload.seguradora,
            data_emissao: new Date().toISOString().slice(0, 10),
            _hasEmittedPolicy: true,
            _effectiveNumeroApolice: payload.numeroApolice,
            _effectiveSeguradora: payload.seguradora,
            _effectiveDataEmissao: new Date().toISOString().slice(0, 10),
            raw_data: {
              ...(item.raw_data || {}),
              recovered_after_cobranca: wasInCobrança,
              recovered_after_cobranca_em: wasInCobrança ? new Date().toISOString() : null,
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
      {isDetail && (
        <button
          type="button"
          onClick={() => navigate({ pathname: '/relatorio', search: location.search }, { replace: false })}
          className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Visão geral
        </button>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
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
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          eyebrow="Relatórios operacionais"
          title={title}
          description={`Kanban analítico da imobiliária em ${periodoLabel}.`}
          actions={overviewActions}
          stats={
            <>
              <MetricCard label="Fichas aprovadas" value={summary.aprovadas} tone="accent" icon={<LayoutGrid className="h-4 w-4" />} />
              <MetricCard label="Aprovadas" value={summary.aprovadas} tone="success" icon={<CheckSquare className="h-4 w-4" />} />
              <MetricCard label="Em cobrança" value={summary.cobranca} tone="warning" icon={<MoveRight className="h-4 w-4" />} />
              <MetricCard label="Apólices emitidas" value={summary.emitidas} tone="secondary" icon={<ShieldCheck className="h-4 w-4" />} />
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
          options={COLUNAS.filter(col => col.id === 'aprovada')}
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

        <DataCard
          title="Kanban mensal"
          subtitle="Arraste fichas entre colunas para atualizar o status. Para cobran?a, selecione as aprovadas e confirme o envio."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollKanban(-1)}
                className="rounded-xl border border-dark-border/60 p-2 text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
                aria-label="Rolar kanban para a esquerda"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollKanban(1)}
                className="rounded-xl border border-dark-border/60 p-2 text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
                aria-label="Rolar kanban para a direita"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={kanbanPointerCollision}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
              <div className="flex min-w-max gap-3 px-1">
                {COLUNAS.map((coluna, index) => (
                  <KanbanColuna
                    key={coluna.id}
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
                    selectionMode={selectionMode}
                    colIndex={index}
                  />
                ))}
              </div>
            </div>

            <DragOverlay dropAnimation={null} modifiers={KANBAN_DRAG_OVERLAY_MODIFIERS}>
              {activeFicha && (
                <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none' }}>
                  <RelatorioCard
                    ficha={activeFicha}
                    onOpen={() => {}}
                    onOpenPolicy={() => {}}
                    selected={false}
                    onToggleSelect={() => {}}
                    selectionMode={false}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </DataCard>

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
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
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
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard label="Fichas aprovadas" value={summary.fichasAprovadas} tone="accent" icon={<LayoutGrid className="h-4 w-4" />} />
          <MetricCard label="Apólices emitidas" value={summary.emitidas} tone="secondary" icon={<ShieldCheck className="h-4 w-4" />} />
          <MetricCard label="Taxa de emissão" value={`${summary.taxaEmissao.toFixed(1)}%`} tone="accent" icon={<BarChart2 className="h-4 w-4" />} />
          <MetricCard label="Em cobrança" value={summary.cobranca} tone="warning" icon={<MoveRight className="h-4 w-4" />} />
          <MetricCard label="Pendentes sem apólice" value={summary.aprovadasSemApolice} tone="warning" icon={<BellRing className="h-4 w-4" />} />
          <MetricCard label="Recuperadas" value={summary.recuperadas} tone="success" icon={<CheckSquare className="h-4 w-4" />} />
          <MetricCard label="Expiradas" value={summary.expiradas} tone="secondary" icon={<Square className="h-4 w-4" />} />
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Taxa de emissão" value={`${summary.taxaEmissao.toFixed(1)}%`} hint="Apólices emitidas ÷ fichas aprovadas" />
        <MetricCard label="Tempo médio até emissão" value={summary.mediaEmissao != null ? `${summary.mediaEmissao.toFixed(1)} dias` : '—'} hint="Entre criação da ficha e emissão" />
        <MetricCard label="Tempo médio em cobrança" value={summary.mediaCobrança != null ? `${summary.mediaCobrança.toFixed(1)} dias` : '—'} hint="Entre cobrança e emissão/atual" />
      </div>

      <DataCard title="Aprovações por seguradora" subtitle="Identifica onde existem aprovações pendentes de emissão.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {seguradoras.map(seg => {
            const approved = rowsWithHelpers.filter(item => matchesSeguradora(item, seg) && getColuna(item) === 'aprovada').length
            const pending = rowsWithHelpers.filter(item => matchesSeguradora(item, seg) && !isEmitida(item)).length
            return (
              <div key={seg.id} className="rounded-3xl border border-dark-border/60 bg-dark-surface/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <SeguradoraBadge nome={seg.nome} logoUrl={seg.logoUrl} logoPath={seg.logoPath} size="md" />
                  <span className="badge badge-info">{approved} aprovadas</span>
                </div>
                <p className="mt-3 text-xs text-dark-muted">{pending} sem apólice emitida</p>
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredImobiliarias.map(imob => {
            const meta = resolverImobiliariaInfo(imob.nome_canonico) || imob
            const imobMetrics = groupedByImob.find(item => normalizeKey(item.nome) === normalizeKey(imob.nome_canonico)) || {
              aprovadas: 0,
              emitidas: 0,
              cobranca: 0,
              recuperadas: 0,
              expiradas: 0,
              aprovadasSemApolice: 0,
            }
            const pendingCount = imobMetrics.aprovadasSemApolice || 0
            const requiresSend = (imobMetrics.aprovadas + imobMetrics.recuperadas + imobMetrics.expiradas) > 0
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
                onClick={() => navigate(`/relatorio/${imob.id}${location.search}`)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/relatorio/${imob.id}${location.search}`)
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

                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-2xl bg-dark-surface/70 px-3 py-2">
                    <p className="text-dark-muted">Aprovadas</p>
                    <p className="mt-1 text-sm font-semibold text-dark-text">{imobMetrics.aprovadas}</p>
                  </div>
                  <div className="rounded-2xl bg-dark-surface/70 px-3 py-2">
                    <p className="text-dark-muted">Cobrança</p>
                    <p className="mt-1 text-sm font-semibold text-dark-text">{imobMetrics.cobranca}</p>
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
                      {requiresSend ? 'Existem fichas fora de cobrança' : cobrancaDone && hasPending ? 'Todas as cobranças foram enviadas' : hasPending ? 'Fichas aguardando emissão' : 'Operação em dia'}
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
    </div>
  )
}











