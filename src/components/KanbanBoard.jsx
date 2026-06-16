import { useState, useCallback } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, closestCenter } from '@dnd-kit/core'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { STATUS_LABELS, PRODUTO_LABELS, marcarRetornoEnviado } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { AVATAR_COLORS, PRODUTO_COLORS } from '../design-system/tokens'
import {
  Home, Building2, Briefcase, FileText as FileTextIcon,
  Clock, User, ClipboardList, CheckCircle2, XCircle, Check, Send,
  GripVertical, ChevronsLeft,
} from 'lucide-react'
import SeguradoraBadge from './SeguradoraBadge'

const COLS = [
  { id: 'pendentes',   label: 'Pendentes',      color: '#4c67b0' },
  { id: 'assumidas',   label: 'Em Cotação',      color: '#3B82F6' },
  { id: 'em_analise',  label: 'Em Análise',      color: '#4b6cc2' },
  { id: 'aprovados',   label: 'Aprovados',       color: '#0f766e' },
  { id: 'recusados',   label: 'Recusados',       color: '#EF4444' },
  { id: 'finalizadas', label: 'Finalizadas',     color: '#6B7280' },
  { id: 'enviadas',    label: 'Retorno Enviado', color: '#2247aa' },
]

const PASSADAS_COLS = ['em_analise', 'aprovados', 'recusados', 'finalizadas']

const PROD_ICON_MAP = { residencial_pf: Home, comercial_pf: Briefcase, pessoa_juridica: Building2 }
const PROD_COLOR    = {
  residencial_pf: PRODUTO_COLORS.residencial_pf.color,
  comercial_pf: PRODUTO_COLORS.comercial_pf.color,
  pessoa_juridica: PRODUTO_COLORS.pessoa_juridica.color,
}
const PROD_ABBR     = { residencial_pf: 'Res. PF', comercial_pf: 'Com. PF', pessoa_juridica: 'PJ' }

function timeSince(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 1) return '<1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
function timeBadgeCls(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 4) return 'badge-success'
  if (h < 24) return 'badge-warning'
  return 'badge-danger'
}
function stringColor(str) {
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(n) {
  return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?'
}

function getCol(ficha) {
  if (ficha.retorno_enviado) return 'enviadas'
  if (ficha.status === 'em_cotacao') return 'assumidas'
  if (ficha.status === 'em_analise') return 'em_analise'
  if (ficha.status === 'aprovado') return 'aprovados'
  if (ficha.status === 'recusado') return 'recusados'
  if (['emitido', 'cancelado', 'cpf_invalido'].includes(ficha.status)) return 'finalizadas'
  return 'pendentes'
}

// ── Card visual ────────────────────────────────────────────────────────────────

function FichaCardContent({
  ficha, userId, onAssumir, onFinalizar, onDetalhe,
  isDragOverlay = false, dragListeners, dragAttributes,
}) {
  const ProdIcon  = PROD_ICON_MAP[ficha.produto] ?? FileTextIcon
  const prodColor = PROD_COLOR[ficha.produto] || '#6B7280'
  const since     = ficha.created_at
  const nome      = ficha.profiles?.nome
  const statusInfo = STATUS_LABELS?.[ficha.status] ?? { label: ficha.status }
  const canAssumir = !ficha.assumida && ficha.status === 'pendente'
  const canFinalizar = ficha.orcamentista_id === userId && ficha.status === 'em_cotacao'

  return (
    <div
      className={`kanban-card${isDragOverlay ? ' kanban-card-dragging' : ''}`}
      style={{ '--kanban-accent': prodColor }}
    >
      {/* Grip handle */}
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

      <div className="kanban-card-body" onClick={() => !isDragOverlay && onDetalhe?.(ficha.id)}>
        {/* Row 1: produto + tempo */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-[3px] rounded-full uppercase tracking-wide select-none"
            style={{ background: prodColor + '20', color: prodColor }}
          >
            <ProdIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
            {PROD_ABBR[ficha.produto] || ''}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${timeBadgeCls(since)}`}>
            {timeSince(since)}
          </span>
        </div>

        {/* Nome */}
        <p className="text-[12.5px] font-semibold text-dark-text leading-snug truncate mb-0.5">
          {ficha.nome_empresa || ficha.nome_interessado || '—'}
        </p>

        {/* Imobiliária */}
        {ficha.imobiliaria && (
          <p className="text-[10px] text-dark-muted truncate leading-none mb-1.5">
            {ficha.imobiliaria}
          </p>
        )}

        {/* Seguradora */}
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
          <div className="flex-shrink-0 flex gap-1">
            {canAssumir && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onAssumir?.(ficha.id) }}
                className="kanban-action-btn kanban-action-assume"
              >
                Assumir
              </button>
            )}
            {canFinalizar && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onFinalizar?.(ficha) }}
                className="kanban-action-btn kanban-action-finish"
              >
                Finalizar
              </button>
            )}
            {ficha.retorno_enviado && (
              <span className="text-[9px] text-status-success font-semibold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Enviado
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DraggableCard ──────────────────────────────────────────────────────────────

function KanbanCard({ ficha, userId, onAssumir, onFinalizar, onDetalhe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ficha.id })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1, transition: isDragging ? 'none' : 'opacity 0.15s ease' }}
    >
      <FichaCardContent
        ficha={ficha}
        userId={userId}
        onAssumir={onAssumir}
        onFinalizar={onFinalizar}
        onDetalhe={onDetalhe}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

// ── Column ─────────────────────────────────────────────────────────────────────

function DroppableColumn({ col, fichas, userId, onAssumir, onFinalizar, onDetalhe, collapsed, onToggleCollapse, colIndex }) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: col.id })
  const { attributes: colAttrs, listeners: colListeners, setNodeRef: setDragRef, isDragging: isColDragging } = useDraggable({
    id: 'col::' + col.id,
    data: { type: 'column', colId: col.id },
  })
  const combinedRef = useCallback((node) => { setDragRef(node); setDropRef(node) }, [setDragRef, setDropRef])
  const animStyle = { animationDelay: `${colIndex * 28}ms`, animationFillMode: 'both' }

  if (collapsed) {
    return (
      <div
        ref={combinedRef}
        className="animate-fade-in flex flex-col flex-shrink-0"
        style={{ width: '52px', ...animStyle, opacity: isColDragging ? 0.25 : 1, transition: 'opacity 0.2s' }}
      >
        <button
          onClick={onToggleCollapse}
          title={`${col.label} (${fichas.length})`}
          className="flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-t-xl border border-b-0 hover:opacity-80 transition-opacity"
          style={{ background: col.color + '14', borderColor: col.color + '45' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color, boxShadow: `0 0 5px ${col.color}80` }} />
          <span className="text-[10px] font-mono font-bold" style={{ color: col.color }}>{fichas.length}</span>
        </button>
        <div
          className="flex-1 rounded-b-xl border transition-colors"
          style={{
            minHeight: '60px',
            borderColor: isOver ? col.color + '70' : 'rgb(var(--color-border))',
            backgroundColor: isOver ? col.color + '14' : 'rgb(var(--color-surface2) / 0.3)',
          }}
        />
      </div>
    )
  }

  return (
    <div
      ref={combinedRef}
      className="kanban-col animate-fade-in flex flex-col"
      style={{ ...animStyle, opacity: isColDragging ? 0.25 : 1, transition: 'opacity 0.2s ease' }}
    >
      <div
        className="kanban-col-header"
        style={{ background: col.color + '12', borderColor: col.color + '40' }}
      >
        <button
          {...colListeners}
          {...colAttrs}
          className="kanban-col-drag-handle"
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
          aria-label={`Arrastar coluna ${col.label}`}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}90` }} />
          <span className="text-[11px] font-bold tracking-wide truncate" style={{ color: col.color }}>{col.label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: col.color + '22', color: col.color }}>
            {fichas.length}
          </span>
          <button onClick={onToggleCollapse} className="kanban-col-collapse" style={{ color: col.color }} title="Colapsar">
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div
        className="kanban-col-body flex-1 p-1.5 space-y-1.5 overflow-y-auto"
        style={{
          border:          isOver ? `1.5px dashed ${col.color}70` : '1px solid rgb(var(--color-border))',
          borderTop:       'none',
          borderRadius:    '0 0 12px 12px',
          backgroundColor: isOver ? col.color + '08' : 'rgb(var(--color-surface2) / 0.35)',
          boxShadow:       isOver ? `inset 0 0 0 1px ${col.color}18` : 'none',
          transition:      'border-color 0.15s ease, background 0.15s ease',
        }}
      >
        {fichas.length === 0 ? (
          <div className="kanban-empty">
            <FileTextIcon className="w-5 h-5 kanban-empty-icon" />
            <span className="kanban-empty-text">Vazia</span>
          </div>
        ) : fichas.map(f => (
          <KanbanCard
            key={f.id}
            ficha={f}
            userId={userId}
            onAssumir={onAssumir}
            onFinalizar={onFinalizar}
            onDetalhe={onDetalhe}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function KanbanBoard({ fichas, onRefresh, onAssumir, onFinalizar, onDetalhe }) {
  const { user }  = useAuth()
  const [activeId, setActiveId] = useState(null)
  const [collapsed, setCollapsed] = useState(new Set())
  const [colOrder,  setColOrder]  = useState(() => {
    try {
      const s = localStorage.getItem('kanban-board-col-order')
      if (s) { const p = JSON.parse(s); if (COLS.every(c => p.includes(c.id)) && p.length === COLS.length) return p }
    } catch {}
    return COLS.map(c => c.id)
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const grouped = {}
  for (const col of COLS) grouped[col.id] = fichas.filter(f => getCol(f) === col.id)

  const isColDrag  = activeId?.startsWith?.('col::')
  const activeColId = isColDrag ? activeId.replace('col::', '') : null
  const activeCol   = activeColId ? COLS.find(c => c.id === activeColId) : null
  const activeFicha = !isColDrag && activeId ? fichas.find(f => f.id === activeId) : null

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    if (active.data.current?.type === 'column') {
      const fromId = active.data.current.colId
      const toId   = over.id
      if (fromId !== toId && COLS.some(c => c.id === toId)) {
        setColOrder(prev => {
          const fi = prev.indexOf(fromId), ti = prev.indexOf(toId)
          if (fi === -1 || ti === -1) return prev
          const next = [...prev]; next.splice(fi, 1); next.splice(ti, 0, fromId)
          try { localStorage.setItem('kanban-board-col-order', JSON.stringify(next)) } catch {}
          return next
        })
      }
      return
    }

    const ficha = fichas.find(f => f.id === active.id)
    if (!ficha) return
    const src = getCol(ficha)
    const dst = over.id
    if (src === dst) return
    if (src === 'pendentes' && dst === 'assumidas') {
      onAssumir?.(ficha.id)
    } else if (src === 'assumidas' && PASSADAS_COLS.includes(dst) && ficha.orcamentista_id === user?.id) {
      onFinalizar?.(ficha)
    } else if (PASSADAS_COLS.includes(src) && dst === 'enviadas') {
      await marcarRetornoEnviado(ficha.id)
      onRefresh?.()
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="kanban-scroll overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max px-1">
          {colOrder.map((colId, i) => {
            const col = COLS.find(c => c.id === colId)
            if (!col) return null
            return (
              <DroppableColumn
                key={col.id}
                col={col}
                fichas={grouped[col.id] ?? []}
                userId={user?.id}
                onAssumir={onAssumir}
                onFinalizar={onFinalizar}
                onDetalhe={onDetalhe}
                collapsed={collapsed.has(col.id)}
                onToggleCollapse={() => toggleCollapse(col.id)}
                colIndex={i}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCol ? (
          <div
            className="kanban-col flex flex-col"
            style={{ transform: 'rotate(2deg)', opacity: 0.9, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}
          >
            <div className="kanban-col-header" style={{ background: activeCol.color + '20', borderColor: activeCol.color + '60' }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-full" style={{ background: activeCol.color }} />
                <span className="text-[11px] font-bold" style={{ color: activeCol.color }}>{activeCol.label}</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: activeCol.color + '30', color: activeCol.color }}>
                {grouped[activeColId]?.length ?? 0}
              </span>
            </div>
            <div className="p-1.5 rounded-b-xl border border-t-0 min-h-[60px]" style={{ background: activeCol.color + '06', borderColor: activeCol.color + '30' }}>
              {(grouped[activeColId] || []).slice(0, 3).map(f => (
                <div key={f.id} className="text-[10px] text-dark-muted truncate py-1 px-2 rounded-lg mb-1" style={{ background: 'rgb(var(--color-surface2) / 0.6)' }}>
                  {f.nome_empresa || f.nome_interessado || '—'}
                </div>
              ))}
            </div>
          </div>
        ) : activeFicha ? (
          <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none', '--kanban-accent': PROD_COLOR[activeFicha?.produto] || '#000079' }}>
            <FichaCardContent ficha={activeFicha} userId={user?.id} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
