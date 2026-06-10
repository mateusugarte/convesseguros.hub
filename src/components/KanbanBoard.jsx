import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { STATUS_LABELS, PRODUTO_LABELS, marcarRetornoEnviado } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import {
  Home, Building2, Briefcase, FileText as FileTextIcon,
  Clock, User, ClipboardList, CheckCircle2, XCircle, Check, Send,
} from 'lucide-react'

const COLS = [
  { id: 'pendentes',  label: 'Pendentes',       Icon: Clock,         color: '#F59E0B' },
  { id: 'assumidas',  label: 'Em Cotação',       Icon: User,          color: '#3B82F6' },
  { id: 'em_analise', label: 'Em Análise',       Icon: ClipboardList, color: '#8B5CF6' },
  { id: 'aprovados',  label: 'Aprovados',        Icon: CheckCircle2,  color: '#10B981' },
  { id: 'recusados',  label: 'Recusados',        Icon: XCircle,       color: '#EF4444' },
  { id: 'finalizadas',label: 'Finalizadas',      Icon: Check,         color: '#6B7280' },
  { id: 'enviadas',   label: 'Retorno Enviado',  Icon: Send,          color: '#2B5BA8' },
]

const PASSADAS_COLS = ['em_analise', 'aprovados', 'recusados', 'finalizadas']

const PROD_ICON_MAP = {
  residencial_pf:  Home,
  comercial_pf:    Building2,
  pessoa_juridica: Briefcase,
}
function ProdIcon({ produto, className = 'w-4 h-4' }) {
  const Icon = PROD_ICON_MAP[produto] ?? FileTextIcon
  return <Icon className={className} />
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

function timeBadgeCls(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 4)  return 'badge-success'
  if (h < 24) return 'badge-warning'
  return 'badge-danger'
}
function timeSince(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 1) return '<1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function KanbanCard({ ficha, onAssumir, onFinalizar, onDetalhe }) {
  const { user } = useAuth()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ficha.id })
  const style     = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const statusInfo = STATUS_LABELS[ficha.status] ?? { label: ficha.status, color: '' }
  const isMinhaFicha = ficha.orcamentista_id === user?.id
  const canAssumir   = !ficha.assumida && ficha.status === 'pendente'
  const since        = ficha.created_at

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={style}
      className={`kanban-card select-none ${isDragging ? 'opacity-0' : ''}`}
    >
      <div
        {...listeners}
        className="p-3 cursor-grab active:cursor-grabbing"
        onClick={() => onDetalhe(ficha.id)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ProdIcon produto={ficha.produto} className="w-4 h-4 flex-shrink-0 text-dark-muted" />
            <span className="text-xs font-semibold text-dark-text truncate">
              {ficha.nome_interessado || 'Sem nome'}
            </span>
          </div>
          <span className={`badge ${statusInfo.color} text-[10px] whitespace-nowrap flex-shrink-0`}>
            {statusInfo.label}
          </span>
        </div>

        {ficha.imobiliaria && (
          <div className="flex items-center gap-1 mb-1.5">
            <Building2 className="w-3 h-3 text-dark-muted/50 flex-shrink-0" />
            <span className="text-xs text-dark-muted truncate">{ficha.imobiliaria}</span>
          </div>
        )}

        {ficha.profiles?.nome && (
          <div className="flex items-center gap-1 mb-1.5">
            <User className="w-3 h-3 text-dark-muted/50 flex-shrink-0" />
            <span className="text-xs text-dark-muted truncate">{ficha.profiles.nome}</span>
          </div>
        )}

        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3 text-dark-muted/40 flex-shrink-0" />
          <span className="text-[10px] text-dark-muted">
            {format(parseISO(ficha.created_at), 'dd/MM/yy', { locale: ptBR })}
          </span>
          <span className={`badge text-[9px] font-mono ml-1 ${timeBadgeCls(since)}`}>
            {timeSince(since)}
          </span>
          {ficha.retorno_enviado && (
            <span className="ml-auto text-[10px] text-status-success font-medium flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Enviado
            </span>
          )}
        </div>
      </div>

      {(canAssumir || isMinhaFicha) && (
        <div
          className="flex gap-1.5 px-3 pb-3"
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {canAssumir && (
            <button
              onClick={() => onAssumir(ficha.id)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-brand-secondary/20 text-brand-accent border border-brand-accent/20 hover:bg-brand-secondary/40 transition-colors font-medium"
            >
              Assumir
            </button>
          )}
          {isMinhaFicha && ficha.status === 'em_cotacao' && (
            <button
              onClick={() => onFinalizar(ficha)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors font-medium"
            >
              Finalizar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DroppableColumn({ col, fichas, onAssumir, onFinalizar, onDetalhe }) {
  const { isOver, setNodeRef } = useDroppable({ id: col.id })
  const ColIcon = col.Icon

  return (
    <div className="flex flex-col min-w-[190px]">
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0 transition-colors"
        style={{ background: col.color + '18', borderColor: col.color + '50' }}
      >
        <div className="flex items-center gap-1.5">
          <ColIcon className="w-4 h-4" style={{ color: col.color }} />
          <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
        </div>
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{ background: col.color + '25', color: col.color }}
        >
          {fichas.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 min-h-[380px] rounded-b-xl p-2 space-y-2 transition-colors duration-150"
        style={{
          border:          isOver ? `2px dashed ${col.color}90` : '1px solid rgb(var(--color-border))',
          backgroundColor: isOver ? col.color + '0c' : 'rgb(var(--color-surface2) / 0.4)',
          boxShadow:       isOver ? `inset 0 0 0 1px ${col.color}20` : 'none',
        }}
      >
        {fichas.length === 0 ? (
          <div className="kanban-empty">
            <FileTextIcon className="w-5 h-5 kanban-empty-icon" />
            <span className="kanban-empty-text">Vazia</span>
          </div>
        ) : (
          fichas.map(f => (
            <KanbanCard
              key={f.id}
              ficha={f}
              onAssumir={onAssumir}
              onFinalizar={onFinalizar}
              onDetalhe={onDetalhe}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ fichas, onRefresh, onAssumir, onFinalizar, onDetalhe }) {
  const { user } = useAuth()
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const grouped = {}
  for (const col of COLS) grouped[col.id] = fichas.filter(f => getCol(f) === col.id)

  const activeFicha = activeId ? fichas.find(f => f.id === activeId) : null

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    const ficha = fichas.find(f => f.id === active.id)
    if (!ficha) return

    const src = getCol(ficha)
    const dst = over.id
    if (src === dst) return

    if (src === 'pendentes' && dst === 'assumidas') {
      onAssumir(ficha.id)
    } else if (src === 'assumidas' && PASSADAS_COLS.includes(dst) && ficha.orcamentista_id === user?.id) {
      onFinalizar(ficha)
    } else if (PASSADAS_COLS.includes(src) && dst === 'enviadas') {
      await marcarRetornoEnviado(ficha.id)
      onRefresh()
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(190px, 1fr))', minWidth: '1330px' }}>
          {COLS.map(col => (
            <DroppableColumn
              key={col.id}
              col={col}
              fichas={grouped[col.id] ?? []}
              onAssumir={onAssumir}
              onFinalizar={onFinalizar}
              onDetalhe={onDetalhe}
            />
          ))}
        </div>
      </div>

      <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
        {activeFicha ? (
          <div
            className="rounded-lg p-3 shadow-2xl w-48 rotate-2 opacity-95 cursor-grabbing"
            style={{ background: 'var(--glass-bg-heavy)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)' }}
          >
            <div className="flex items-center gap-1.5">
              <ProdIcon produto={activeFicha.produto} className="w-4 h-4 text-dark-muted" />
              <span className="text-xs font-semibold text-dark-text truncate">
                {activeFicha.nome_interessado || 'Sem nome'}
              </span>
            </div>
            {activeFicha.imobiliaria && (
              <p className="text-xs text-dark-muted mt-1 truncate">{activeFicha.imobiliaria}</p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
