import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { STATUS_LABELS, PRODUTO_LABELS, marcarRetornoEnviado } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'

const COLS = [
  {
    id: 'pendentes',
    label: 'Pendentes',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    headerBg: 'bg-amber-50', headerBorder: 'border-amber-200', titleColor: 'text-amber-800',
    badgeClass: 'bg-amber-100 text-amber-700', bodyBorder: 'border-amber-100', hoverBg: 'bg-amber-50/60',
  },
  {
    id: 'assumidas',
    label: 'Em Cotação',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    headerBg: 'bg-blue-50', headerBorder: 'border-blue-200', titleColor: 'text-blue-800',
    badgeClass: 'bg-blue-100 text-blue-700', bodyBorder: 'border-blue-100', hoverBg: 'bg-blue-50/60',
  },
  {
    id: 'em_analise',
    label: 'Em Análise',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    headerBg: 'bg-purple-50', headerBorder: 'border-purple-200', titleColor: 'text-purple-800',
    badgeClass: 'bg-purple-100 text-purple-700', bodyBorder: 'border-purple-100', hoverBg: 'bg-purple-50/60',
  },
  {
    id: 'aprovados',
    label: 'Aprovados',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    headerBg: 'bg-green-50', headerBorder: 'border-green-200', titleColor: 'text-green-800',
    badgeClass: 'bg-green-100 text-green-700', bodyBorder: 'border-green-100', hoverBg: 'bg-green-50/60',
  },
  {
    id: 'recusados',
    label: 'Recusados',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    headerBg: 'bg-red-50', headerBorder: 'border-red-200', titleColor: 'text-red-800',
    badgeClass: 'bg-red-100 text-red-700', bodyBorder: 'border-red-100', hoverBg: 'bg-red-50/60',
  },
  {
    id: 'finalizadas',
    label: 'Finalizadas',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    headerBg: 'bg-gray-50', headerBorder: 'border-gray-200', titleColor: 'text-gray-700',
    badgeClass: 'bg-gray-200 text-gray-600', bodyBorder: 'border-gray-100', hoverBg: 'bg-gray-100/60',
  },
  {
    id: 'enviadas',
    label: 'Retorno Enviado',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    headerBg: 'bg-emerald-50', headerBorder: 'border-emerald-200', titleColor: 'text-emerald-800',
    badgeClass: 'bg-emerald-100 text-emerald-700', bodyBorder: 'border-emerald-100', hoverBg: 'bg-emerald-50/60',
  },
]

// Columns that are considered "finalizadas" for drag-drop purposes
const PASSADAS_COLS = ['em_analise', 'aprovados', 'recusados', 'finalizadas']

const PROD_ICONS = {
  residencial_pf:  '🏠',
  comercial_pf:    '🏢',
  pessoa_juridica: '🏛️',
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

function KanbanCard({ ficha, onAssumir, onFinalizar, onDetalhe }) {
  const { user } = useAuth()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ficha.id })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const statusInfo = STATUS_LABELS[ficha.status] ?? { label: ficha.status, color: 'bg-gray-100 text-gray-600' }
  const isMinhaFicha = ficha.orcamentista_id === user?.id
  const canAssumir = !ficha.assumida && ficha.status === 'pendente'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`rounded-lg border bg-white shadow-sm select-none transition-all ${
        isDragging ? 'opacity-0' : 'border-gray-200 hover:shadow-md hover:border-gray-300'
      }`}
    >
      <div
        {...listeners}
        className="p-3 cursor-grab active:cursor-grabbing"
        onClick={() => onDetalhe(ficha.id)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base flex-shrink-0">{PROD_ICONS[ficha.produto] ?? '📄'}</span>
            <span className="text-xs font-semibold text-gray-800 truncate">
              {ficha.nome_interessado || 'Sem nome'}
            </span>
          </div>
          <span className={`badge ${statusInfo.color} text-[10px] whitespace-nowrap flex-shrink-0`}>
            {statusInfo.label}
          </span>
        </div>

        {ficha.imobiliaria && (
          <div className="flex items-center gap-1 mb-1.5">
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-xs text-gray-500 truncate">{ficha.imobiliaria}</span>
          </div>
        )}

        {ficha.profiles?.nome && (
          <div className="flex items-center gap-1 mb-1.5">
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs text-gray-400 truncate">{ficha.profiles.nome}</span>
          </div>
        )}

        <div className="flex items-center gap-1 mt-1">
          <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] text-gray-400">
            {format(parseISO(ficha.created_at), "dd/MM/yy", { locale: ptBR })}
          </span>
          {ficha.retorno_enviado && (
            <span className="ml-auto text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Enviado
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
              className="text-[11px] px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
            >
              Assumir
            </button>
          )}
          {isMinhaFicha && ficha.status === 'em_cotacao' && (
            <button
              onClick={() => onFinalizar(ficha)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
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

  return (
    <div className="flex flex-col min-w-[190px]">
      <div className={`rounded-t-xl border-x border-t ${col.headerBorder} ${col.headerBg} px-3 py-2.5 flex items-center justify-between`}>
        <div className={`flex items-center gap-1.5 ${col.titleColor}`}>
          {col.icon}
          <span className="text-xs font-semibold">{col.label}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badgeClass}`}>
          {fichas.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[380px] rounded-b-xl border ${col.bodyBorder} p-2 space-y-2 transition-colors duration-150 ${
          isOver ? col.hoverBg + ' ring-2 ring-inset ring-blue-300' : 'bg-gray-50/40'
        }`}
      >
        {fichas.length === 0 ? (
          <div className="h-24 flex flex-col items-center justify-center text-gray-300 gap-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[11px]">Vazio</span>
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

      <DragOverlay dropAnimation={null}>
        {activeFicha ? (
          <div className="bg-white rounded-lg border border-blue-300 p-3 shadow-2xl w-48 rotate-2 opacity-95">
            <div className="flex items-center gap-1.5">
              <span>{PROD_ICONS[activeFicha.produto] ?? '📄'}</span>
              <span className="text-xs font-semibold text-gray-800 truncate">
                {activeFicha.nome_interessado || 'Sem nome'}
              </span>
            </div>
            {activeFicha.imobiliaria && (
              <p className="text-xs text-gray-400 mt-1 truncate">{activeFicha.imobiliaria}</p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
