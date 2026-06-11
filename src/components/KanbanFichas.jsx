import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { fetchFichasKanban, assumirFicha, moverFichaStatus, PRODUTO_LABELS } from '../lib/fichas'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import ModalFinalizar from './ModalFinalizar'
import {
  Home, Briefcase, Building, LayoutGrid, RefreshCw,
  ChevronLeft, ChevronRight, Calendar, GripVertical,
  ChevronsLeft, ArrowRight,
} from 'lucide-react'
import SeguradoraBadge from './SeguradoraBadge'
import SeguradoraSelect from './SeguradoraSelect'
import { KanbanSkeleton } from './Skeleton'
import { DatePicker } from './ui/DatePicker'

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'pendente',   label: 'Pendentes',     color: '#3B82F6' },
  { id: 'assumidas',  label: 'Assumidas',     color: '#F59E0B' },
  { id: 'minhas',     label: 'Minhas Fichas', color: '#C9A84C' },
  { id: 'em_analise', label: 'Em Análise',    color: '#4A90D9' },
  { id: 'aprovado',   label: 'Aprovadas',     color: '#10B981' },
  { id: 'recusado',   label: 'Recusadas',     color: '#EF4444' },
  { id: 'emitido',    label: 'Emitidas',      color: '#2B5BA8' },
  { id: 'expirada',   label: 'Expiradas',     color: '#6B7280' },
]

const COL_TO_STATUS = {
  pendente: 'pendente', assumidas: 'em_cotacao', minhas: 'em_cotacao',
  em_analise: 'em_analise', aprovado: 'aprovado', recusado: 'recusado',
  emitido: 'emitido', expirada: 'expirada',
}

const PRODUTO_ICON = {
  residencial_pf:  Home,
  comercial_pf:    Briefcase,
  pessoa_juridica: Building,
}

const PRODUTO_COLOR = {
  residencial_pf:  '#4A90D9',
  comercial_pf:    '#10B981',
  pessoa_juridica: '#8B5CF6',
}

const PRODUTO_ABBR = {
  residencial_pf:  'Res. PF',
  comercial_pf:    'Com. PF',
  pessoa_juridica: 'PJ',
}

const PERIODOS = [
  { key: 'hoje',   label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes',    label: 'Mês' },
  { key: 'custom', label: 'Personalizado' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriodDates(periodo, customFrom, customTo) {
  const now = new Date()
  if (periodo === 'hoje') {
    const s = new Date(now); s.setHours(0, 0, 0, 0)
    return [s.toISOString(), now.toISOString()]
  }
  if (periodo === 'semana') {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0)
    return [s.toISOString(), now.toISOString()]
  }
  if (periodo === 'mes') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    return [s.toISOString(), now.toISOString()]
  }
  if (periodo === 'custom') return [customFrom || null, customTo ? new Date(customTo + 'T23:59:59').toISOString() : null]
  return [null, null]
}

function getColumnId(ficha, userId) {
  if (ficha.status === 'pendente') return 'pendente'
  if (ficha.status === 'em_cotacao') return ficha.orcamentista_id === userId ? 'minhas' : 'assumidas'
  return ficha.status
}

function groupFichas(fichas, userId) {
  const cols = Object.fromEntries(COLUMNS.map(c => [c.id, []]))
  fichas.forEach(f => {
    const colId = getColumnId(f, userId)
    if (cols[colId] !== undefined) cols[colId].push(f)
  })
  for (const colId of ['aprovado', 'recusado']) {
    cols[colId].sort((a, b) =>
      new Date(b.finalizada_em || b.created_at) - new Date(a.finalizada_em || a.created_at)
    )
  }
  return cols
}

function timeSince(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 1) return '<1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function timeBadgeCls(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 4)  return 'badge-success'
  if (h < 24) return 'badge-warning'
  return 'badge-danger'
}

function stringColor(str) {
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) {
  return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?'
}
function nomePrincipal(ficha) {
  if (ficha.produto === 'pessoa_juridica') return ficha.nome_empresa || ficha.nome_interessado || '—'
  return ficha.nome_interessado || '—'
}

// ── FichaCard ─────────────────────────────────────────────────────────────────

function FichaCard({
  ficha, userId, onAssumir, onFinalizar,
  isDragOverlay = false, isNew = false,
  resolverNome, dragListeners, dragAttributes,
}) {
  const ProdIcon  = PRODUTO_ICON[ficha.produto] || LayoutGrid
  const prodColor = PRODUTO_COLOR[ficha.produto] || '#4A90D9'
  const since     = ficha.assumida_em || ficha.created_at
  const nome      = ficha.profiles?.nome

  return (
    <div
      className={`kanban-card${isNew ? ' animate-card-new' : ''}${isDragOverlay ? ' kanban-card-dragging' : ''}`}
    >
      {/* Grip handle — só no drag, não no overlay */}
      {!isDragOverlay && (
        <button
          {...dragListeners}
          {...dragAttributes}
          className="kanban-grip"
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
          aria-label="Arrastar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Card body */}
      <div className="kanban-card-body">

        {/* Row 1: produto badge + tempo */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-[3px] rounded-full uppercase tracking-wide select-none"
            style={{ background: prodColor + '20', color: prodColor }}
          >
            <ProdIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
            {PRODUTO_ABBR[ficha.produto] || ''}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${timeBadgeCls(since)}`}>
            {timeSince(since)}
          </span>
        </div>

        {/* Row 2: nome */}
        <p className="text-[12.5px] font-semibold text-dark-text leading-snug truncate mb-0.5">
          {nomePrincipal(ficha)}
        </p>

        {/* Row 3: imobiliária */}
        <p className="text-[10px] text-dark-muted truncate leading-none mb-1.5">
          {(resolverNome ? resolverNome(ficha.imobiliaria) : ficha.imobiliaria) || '—'}
        </p>

        {/* Row 4: seguradora (se definida) */}
        {ficha.seguradora && (
          <div className="mb-1.5">
            <SeguradoraBadge nome={ficha.seguradora} size="xs" />
          </div>
        )}

        {/* Footer: orcamentista + ação */}
        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-dark-border/40 mt-auto">
          {nome ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                style={{ background: stringColor(nome) }}
                title={nome}
              >
                {initials(nome)}
              </div>
              <span className="text-[10px] text-dark-muted font-medium truncate max-w-[72px]">
                {nome.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-[9px] text-status-warning font-semibold tracking-wide uppercase">Livre</span>
          )}

          <div className="flex-shrink-0">
            {ficha.status === 'pendente' && !ficha.assumida && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onAssumir(ficha.id) }}
                className="kanban-action-btn kanban-action-assume"
              >
                Assumir
              </button>
            )}
            {ficha.status === 'em_cotacao' && ficha.orcamentista_id === userId && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onFinalizar(ficha, null) }}
                className="kanban-action-btn kanban-action-finish"
              >
                Finalizar
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── DraggableCard ─────────────────────────────────────────────────────────────

function DraggableCard({ ficha, userId, onDetalhe, onAssumir, onFinalizar, isNew, resolverNome }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ficha.id })

  return (
    <div
      ref={setNodeRef}
      onClick={() => !isDragging && onDetalhe(ficha.id)}
      style={{
        opacity:    isDragging ? 0.35 : 1,
        transition: isDragging ? 'none' : 'opacity 0.15s ease',
      }}
    >
      <FichaCard
        ficha={ficha}
        userId={userId}
        onAssumir={onAssumir}
        onFinalizar={onFinalizar}
        isNew={isNew}
        resolverNome={resolverNome}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

// ── DroppableColumn ───────────────────────────────────────────────────────────

function DroppableColumn({
  column, fichas, userId, onDetalhe, onAssumir, onFinalizar,
  collapsed, onToggleCollapse, newIds, colIndex, resolverNome,
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id })
  const animStyle = { animationDelay: `${colIndex * 28}ms`, animationFillMode: 'both', scrollSnapAlign: 'start' }

  if (collapsed) {
    return (
      <div className="animate-fade-in flex flex-col flex-shrink-0" style={{ width: '48px', ...animStyle }}>
        <button
          onClick={onToggleCollapse}
          title={`${column.label} (${fichas.length}) — expandir`}
          className="flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-t-xl border border-b-0 hover:opacity-80 transition-opacity"
          style={{ background: column.color + '14', borderColor: column.color + '45' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: column.color, boxShadow: `0 0 5px ${column.color}80` }}
          />
          <span className="text-[10px] font-mono font-bold" style={{ color: column.color }}>
            {fichas.length}
          </span>
          <ArrowRight className="w-3 h-3 opacity-40" style={{ color: column.color }} />
        </button>
        <div
          ref={setNodeRef}
          className="flex-1 rounded-b-xl border transition-colors duration-150"
          style={{
            minHeight: '60px',
            borderColor:     isOver ? column.color + '70' : 'rgb(var(--color-border))',
            backgroundColor: isOver ? column.color + '12' : 'rgb(var(--color-surface2) / 0.3)',
            boxShadow:       isOver ? `inset 0 0 0 1.5px ${column.color}40` : 'none',
          }}
        />
      </div>
    )
  }

  return (
    <div className="kanban-col animate-fade-in flex flex-col" style={animStyle}>

      {/* Column header */}
      <div
        className="kanban-col-header"
        style={{
          background:   column.color + '12',
          borderColor:  column.color + '40',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: column.color, boxShadow: `0 0 6px ${column.color}90` }}
          />
          <span
            className="text-[11px] font-bold tracking-wide truncate"
            style={{ color: column.color }}
          >
            {column.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: column.color + '22', color: column.color }}
          >
            {fichas.length}
          </span>
          <button
            onClick={onToggleCollapse}
            title="Colapsar coluna"
            className="kanban-col-collapse"
            style={{ color: column.color }}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className="kanban-col-body flex-1 p-1.5 space-y-1.5 overflow-y-auto"
        style={{
          border:          isOver
            ? `1.5px dashed ${column.color}70`
            : '1px solid rgb(var(--color-border))',
          borderTop:       'none',
          borderRadius:    '0 0 12px 12px',
          backgroundColor: isOver
            ? column.color + '08'
            : 'rgb(var(--color-surface2) / 0.35)',
          boxShadow:       isOver
            ? `inset 0 0 0 1px ${column.color}18, 0 0 14px ${column.color}12`
            : 'none',
          transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        {fichas.length === 0 ? (
          <div className="kanban-empty">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="kanban-empty-icon">
              <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 2"/>
            </svg>
            <span className="kanban-empty-text">Vazia</span>
          </div>
        ) : fichas.map(f => (
          <DraggableCard
            key={f.id}
            ficha={f}
            userId={userId}
            onDetalhe={onDetalhe}
            onAssumir={onAssumir}
            onFinalizar={onFinalizar}
            isNew={newIds?.has(f.id)}
            resolverNome={resolverNome}
          />
        ))}
      </div>
    </div>
  )
}

// ── ModalConfirmarRecusado ────────────────────────────────────────────────────

function ModalConfirmarRecusado({ onConfirmar, salvando }) {
  const [retorno, setRetorno] = useState(null)
  return (
    <div className="glass-panel rounded-2xl animate-fade-in">
      <div className="px-6 py-5 space-y-4">
        <p className="font-semibold text-dark-text text-sm">Confirmar Recusa</p>
        <p className="text-xs text-dark-muted">O retorno foi enviado ao cliente?</p>
        <div className="flex gap-3">
          {[{ v: true, l: 'Sim', cls: 'border-status-success text-status-success bg-status-success/20' },
            { v: false, l: 'Não', cls: 'border-status-danger text-status-danger bg-status-danger/20' }].map(({ v, l, cls }) => (
            <button key={l} onClick={() => setRetorno(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                retorno === v ? cls : 'border-dark-border text-dark-muted hover:border-dark-text'
              }`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end px-6 pb-5">
        <button onClick={() => retorno !== null && onConfirmar(retorno)}
          disabled={retorno === null || salvando} className="btn-primary text-sm">
          {salvando ? 'Salvando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

// ── ModalConfirmarAprovado ────────────────────────────────────────────────────

function ModalConfirmarAprovado({ onConfirmar, onCancelar, salvando }) {
  const [seguradora,      setSeguradora]      = useState('')
  const [valorParcela,    setValorParcela]    = useState('')
  const [numeroOrcamento, setNumeroOrcamento] = useState('')
  const [retornoEnviado,  setRetornoEnviado]  = useState(null)
  const valido = seguradora && valorParcela && numeroOrcamento.trim() && retornoEnviado !== null

  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-dark-border">
        <p className="font-semibold text-dark-text">Confirmar Aprovação</p>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
            Seguradora <span className="text-status-danger">*</span>
          </label>
          <SeguradoraSelect value={seguradora} onChange={setSeguradora} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
              Valor Parcela (R$) <span className="text-status-danger">*</span>
            </label>
            <input type="number" step="0.01" min="0" value={valorParcela}
              onChange={e => setValorParcela(e.target.value)} placeholder="0,00" className="input text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
              N° Orçamento <span className="text-status-danger">*</span>
            </label>
            <input value={numeroOrcamento} onChange={e => setNumeroOrcamento(e.target.value)}
              placeholder="Ex: 12345" className="input text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
            Retorno enviado? <span className="text-status-danger">*</span>
          </label>
          <div className="flex gap-3">
            {[{ v: true, l: 'Sim', cls: 'border-status-success text-status-success bg-status-success/20' },
              { v: false, l: 'Não', cls: 'border-status-danger text-status-danger bg-status-danger/20' }].map(({ v, l, cls }) => (
              <button key={l} onClick={() => setRetornoEnviado(v)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                  retornoEnviado === v ? cls : 'border-dark-border text-dark-muted hover:border-dark-text'
                }`}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 pb-5">
        <button onClick={onCancelar} className="btn-secondary text-sm">Cancelar</button>
        <button
          onClick={() => valido && onConfirmar({ seguradora, valorParcela: parseFloat(valorParcela), numeroOrcamento: numeroOrcamento.trim(), retornoEnviado })}
          disabled={!valido || salvando} className="btn-primary text-sm">
          {salvando ? 'Salvando...' : 'Confirmar Aprovação'}
        </button>
      </div>
    </div>
  )
}

// ── Main KanbanFichas ─────────────────────────────────────────────────────────

export default function KanbanFichas({ produto, externalDateFrom, externalDateTo, contextState }) {
  const { user }         = useAuth()
  const toast            = useToast()
  const navigate         = useNavigate()
  const { resolverNome } = useImobiliaria()

  const useExternal = !!(externalDateFrom || externalDateTo)

  const [fichas,   setFichas]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [finalizar,              setFinalizar]              = useState(null)
  const [finalizarDefaultStatus, setFinalizarDefaultStatus] = useState(null)

  const [periodo,    setPeriodo]    = useState('hoje')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [collapsed,  setCollapsed]  = useState(new Set())
  const [newIds,     setNewIds]     = useState(new Set())

  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)
  const scrollRef        = useRef(null)
  const newIdTimeoutsRef = useRef(new Set())

  const [pendingRecusado,   setPendingRecusado]   = useState(null)
  const [salvandoRecusado,  setSalvandoRecusado]  = useState(false)
  const [pendingAprovado,   setPendingAprovado]   = useState(null)
  const [salvandoAprovado,  setSalvandoAprovado]  = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const load = useCallback(async () => {
    setLoading(true)
    let dateFrom, dateTo
    if (useExternal) {
      dateFrom = externalDateFrom
      dateTo   = externalDateTo
    } else {
      [dateFrom, dateTo] = getPeriodDates(periodo, customFrom, customTo)
    }
    const data = await fetchFichasKanban({ produto, dateFrom, dateTo })
    setFichas(data)

    const cols = groupFichas(data, user?.id)
    const emptyCols = COLUMNS.filter(c => cols[c.id].length === 0).map(c => c.id)
    setCollapsed(new Set(emptyCols))

    setLoading(false)
  }, [produto, periodo, customFrom, customTo, user?.id, useExternal, externalDateFrom, externalDateTo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel('kanban-fichas-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fichas' }, p => {
        const nova = p.new
        if (produto && produto !== 'todos' && nova.produto !== produto) return
        setFichas(prev => [nova, ...prev])
        setCollapsed(prev => { const next = new Set(prev); next.delete('pendente'); return next })
        setNewIds(prev => new Set([...prev, nova.id]))
        const t = setTimeout(() => {
          setNewIds(prev => { const next = new Set(prev); next.delete(nova.id); return next })
          newIdTimeoutsRef.current.delete(t)
        }, 3000)
        newIdTimeoutsRef.current.add(t)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fichas' }, p => {
        const updated = p.new
        if (produto && produto !== 'todos' && updated.produto !== produto) return
        setFichas(prev => prev.map(f =>
          f.id === updated.id ? { ...updated, profiles: f.profiles } : f
        ))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'fichas' }, p => {
        setFichas(prev => prev.filter(f => f.id !== p.old.id))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
      newIdTimeoutsRef.current.forEach(t => clearTimeout(t))
      newIdTimeoutsRef.current.clear()
    }
  }, [produto])

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollL(el.scrollLeft > 5)
    setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect() }
  }, [loading])

  function scrollBy(dir) {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
  }

  const cols       = groupFichas(fichas, user?.id)
  const activeCard = activeId ? fichas.find(f => f.id === activeId) : null

  async function handleAssumir(fichaId) {
    const fichaOriginal = fichas.find(f => f.id === fichaId)
    if (!fichaOriginal) return
    setFichas(prev => prev.map(f =>
      f.id !== fichaId ? f : {
        ...f, assumida: true, orcamentista_id: user?.id,
        status: 'em_cotacao', assumida_em: new Date().toISOString(),
      }
    ))
    setCollapsed(prev => { const next = new Set(prev); next.delete('minhas'); return next })
    const err = await assumirFicha(fichaId, user.id)
    if (err) {
      setFichas(prev => prev.map(f => f.id === fichaId ? fichaOriginal : f))
      toast({ type: 'error', title: 'Erro ao assumir ficha' })
    } else {
      toast({ type: 'success', title: 'Ficha assumida!' })
    }
  }

  function handleFinalizar(ficha, defaultStatus) {
    setFinalizar(ficha)
    setFinalizarDefaultStatus(defaultStatus || null)
  }

  async function handleConfirmarRecusado(retornoEnviado) {
    if (!pendingRecusado) return
    setSalvandoRecusado(true)
    const err = await moverFichaStatus(pendingRecusado.fichaId, 'recusado', { userId: user?.id })
    if (!err) {
      await supabase.from('fichas').update({
        retorno_enviado: retornoEnviado,
        finalizada_em: new Date().toISOString(),
      }).eq('id', pendingRecusado.fichaId)
      toast({ type: 'success', title: 'Ficha recusada' })
    } else {
      setFichas(prev => prev.map(f => f.id === pendingRecusado.fichaId ? pendingRecusado.fichaOriginal : f))
      toast({ type: 'error', title: 'Erro ao recusar ficha' })
    }
    setSalvandoRecusado(false)
    setPendingRecusado(null)
  }

  async function handleConfirmarAprovado({ seguradora, valorParcela, numeroOrcamento, retornoEnviado }) {
    if (!pendingAprovado) return
    setSalvandoAprovado(true)
    const err = await moverFichaStatus(pendingAprovado.fichaId, 'aprovado', { userId: user?.id })
    if (!err) {
      await supabase.from('fichas').update({
        seguradora,
        valor_parcela: valorParcela,
        numero_orcamento: numeroOrcamento,
        retorno_enviado: retornoEnviado,
        finalizada_em: new Date().toISOString(),
      }).eq('id', pendingAprovado.fichaId)
      toast({ type: 'success', title: 'Ficha aprovada!' })
      load()
    } else {
      setFichas(prev => prev.map(f => f.id === pendingAprovado.fichaId ? pendingAprovado.fichaOriginal : f))
      toast({ type: 'error', title: 'Erro ao aprovar ficha' })
    }
    setSalvandoAprovado(false)
    setPendingAprovado(null)
  }

  function handleCancelarAprovado() {
    if (!pendingAprovado) return
    setFichas(prev => prev.map(f => f.id === pendingAprovado.fichaId ? pendingAprovado.fichaOriginal : f))
    setPendingAprovado(null)
  }

  function handleDetalhe(fichaId) {
    navigate(`/fichas/${fichaId}`, {
      state: { from: '/fichas', scrollY: window.scrollY, ...contextState },
    })
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    const fichaId   = active.id
    const targetCol = over.id
    const ficha     = fichas.find(f => f.id === fichaId)
    if (!ficha) return

    const sourceCol = getColumnId(ficha, user?.id)
    if (sourceCol === targetCol) return

    const novoStatus = COL_TO_STATUS[targetCol]
    if (!novoStatus) return

    if (targetCol === 'recusado') {
      setPendingRecusado({ fichaId, fichaOriginal: ficha })
      return
    }
    if (targetCol === 'aprovado') {
      setPendingAprovado({ fichaId, fichaOriginal: ficha })
      return
    }

    const assumirComoAtual = targetCol === 'minhas'

    setFichas(prev => prev.map(f => {
      if (f.id !== fichaId) return f
      const u = { ...f, status: novoStatus }
      if (assumirComoAtual) { u.orcamentista_id = user?.id; u.assumida = true; u.assumida_em = f.assumida_em || new Date().toISOString() }
      if (targetCol === 'pendente') { u.orcamentista_id = null; u.assumida = false; u.assumida_em = null }
      return u
    }))

    const err = await moverFichaStatus(fichaId, novoStatus, { assumir: assumirComoAtual, userId: user?.id })
    if (err) {
      toast({ type: 'error', title: 'Erro ao mover ficha' })
      load()
    } else {
      const colLabel = COLUMNS.find(c => c.id === targetCol)?.label ?? targetCol
      toast({ type: 'success', title: `Movida para ${colLabel}` })
    }
  }

  function toggleCollapse(colId) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else next.add(colId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-16 rounded-md bg-dark-border/40 animate-pulse" />
          ))}
        </div>
        <KanbanSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Period filter bar */}
      {!useExternal && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 bg-dark-surface2/60 border border-dark-border rounded-lg p-0.5">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodo === p.key
                    ? 'bg-brand-secondary text-white shadow-sm'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodo === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs text-dark-muted">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <DatePicker value={customFrom} onChange={v => setCustomFrom(v)} />
              <span>—</span>
              <DatePicker value={customTo} onChange={v => setCustomTo(v)} />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs text-dark-muted">
            <span>{fichas.length} ficha{fichas.length !== 1 ? 's' : ''}</span>
            <button onClick={load} className="flex items-center gap-1 hover:text-dark-text transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          </div>
        </div>
      )}

      {useExternal && (
        <div className="flex items-center justify-between text-xs text-dark-muted">
          <span>{fichas.length} ficha{fichas.length !== 1 ? 's' : ''} neste período</span>
          <button onClick={load} className="flex items-center gap-1 hover:text-dark-text transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      )}

      {/* Modals inline */}
      {(finalizar || pendingRecusado || pendingAprovado) ? (
        <>
          {finalizar && (
            <ModalFinalizar
              ficha={finalizar}
              defaultStatus={finalizarDefaultStatus}
              onClose={() => { setFinalizar(null); setFinalizarDefaultStatus(null) }}
              onSuccess={() => { setFinalizar(null); setFinalizarDefaultStatus(null); load() }}
            />
          )}
          {pendingRecusado && (
            <ModalConfirmarRecusado onConfirmar={handleConfirmarRecusado} salvando={salvandoRecusado} />
          )}
          {pendingAprovado && (
            <ModalConfirmarAprovado onConfirmar={handleConfirmarAprovado} onCancelar={handleCancelarAprovado} salvando={salvandoAprovado} />
          )}
        </>
      ) : (
        <div className="relative">
          {/* Scroll fade gradients */}
          {canScrollL && (
            <div className="absolute left-0 top-0 bottom-4 w-14 z-10 pointer-events-none"
                 style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }} />
          )}
          {canScrollR && (
            <div className="absolute right-0 top-0 bottom-4 w-14 z-10 pointer-events-none"
                 style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }} />
          )}
          {canScrollL && (
            <button onClick={() => scrollBy('left')}
              className="absolute left-0.5 top-[54px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-lg flex items-center justify-center text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {canScrollR && (
            <button onClick={() => scrollBy('right')}
              className="absolute right-0.5 top-[54px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-lg flex items-center justify-center text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
            <DndContext
              sensors={sensors}
              onDragStart={({ active }) => setActiveId(active.id)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="flex gap-2 min-w-max px-0.5">
                {COLUMNS.map((col, i) => (
                  <DroppableColumn
                    key={col.id}
                    column={col}
                    fichas={cols[col.id] || []}
                    userId={user?.id}
                    onDetalhe={handleDetalhe}
                    onAssumir={handleAssumir}
                    onFinalizar={handleFinalizar}
                    collapsed={collapsed.has(col.id)}
                    onToggleCollapse={() => toggleCollapse(col.id)}
                    newIds={newIds}
                    colIndex={i}
                    resolverNome={resolverNome}
                  />
                ))}
              </div>

              <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
                {activeCard && (
                  <div style={{ width: 'calc(var(--kanban-col-w, 232px) - 12px)' }}>
                    <FichaCard
                      ficha={activeCard}
                      userId={user?.id}
                      onAssumir={() => {}}
                      onFinalizar={() => {}}
                      isDragOverlay
                      resolverNome={resolverNome}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  )
}
