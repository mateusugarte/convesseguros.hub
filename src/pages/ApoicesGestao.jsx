import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import {

  STATUS_EMISSAO_LABELS,
  calculatePremioTotal, calculateValorComissao, formatMoneyBR, toNumber,
} from '../lib/apolices'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { Select } from '../components/ui/Select'
import { DatePicker } from '../components/ui/DatePicker'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { STATUS_LABELS } from '../lib/fichas'
import { fetchFichasAprovadasEmissao } from '../lib/fichas'
import { formatDecimalBRInput } from '../lib/numberInput'
import {
  Plus, ChevronLeft, ChevronRight, RefreshCw,
  Search, Home, Briefcase, Building, LayoutGrid, X, Check, ArrowLeft,
  GripVertical, ChevronsLeft, Pencil, Upload, Sparkles,
} from 'lucide-react'
import SeguradoraBadge from '../components/SeguradoraBadge'
import SeguradoraSelect from '../components/SeguradoraSelect'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { Avatar } from '../components/ui'
import { supabase } from '../lib/supabase'
      {/* Kanban */}
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../lib/kanbanDnd'
import { normalizeDisplayText } from '../lib/text'
import { parseApolice } from '../lib/apoliceParser'

// Constantes

const COLUNAS = [
  { id: 'recebida',             label: 'Recebida',             color: '#3B82F6' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', color: '#F59E0B' },
  { id: 'emitida',              label: 'Apólice Emitida',      color: '#8B5CF6' },
  { id: 'enviada',              label: 'Apólice Enviada',      color: '#10B981' },
]

const PRODUTO_ICON  = { residencial_pf: Home, comercial_pf: Briefcase, pessoa_juridica: Building }
const PRODUTO_COLOR = { residencial_pf: '#4A90D9', comercial_pf: '#10B981', pessoa_juridica: '#8B5CF6' }
const PRODUTO_ABBR  = { residencial_pf: 'Res. PF', comercial_pf: 'Com. PF', pessoa_juridica: 'PJ' }

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
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) {
  return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?'
}

function getPeriodDates(filtro) {
  const now = new Date()
  if (filtro === 'hoje') {
    const s = new Date(now); s.setHours(0,0,0,0)
    return [s.toISOString(), now.toISOString()]
  }
  if (filtro === 'semana') {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0,0,0,0)
    return [s.toISOString(), now.toISOString()]
  }
  const s = new Date(now.getFullYear(), now.getMonth(), 1)
  return [s.toISOString(), now.toISOString()]
}

function calcularMeses(inicio, fim) {
  if (!inicio || !fim) return 0
  return Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / (1000 * 60 * 60 * 24 * 30)))
}

function isLikelyPolicyNumber(value) {
  const text = String(value || '').trim()
  return text.length > 0 && /^[0-9./-]+$/.test(text)
}

function FieldShell({ label, required, children }) {
  return (
    <div className="group relative rounded-3xl border border-transparent px-2 py-1.5 transition-all hover:border-brand-accent/20 hover:bg-dark-surface2/20">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-muted">
        {label}{required && <span className="ml-0.5 text-status-danger">*</span>}
      </label>
      <div className="relative">
        {children}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-dark-border/70 bg-white px-2 py-1 text-[10px] font-semibold text-dark-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <span className="inline-flex items-center gap-1">
            <Pencil className="h-3 w-3" />
            Editar
          </span>
        </span>
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text', placeholder, required, inputMode }) {
  return (
    <FieldShell label={label} required={required}>
      {type === 'date' ? (
        <DatePicker value={value || ''} onChange={onChange} className="w-full" />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input text-sm pr-20"
        />
      )}
    </FieldShell>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  const normalized = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <FieldShell label={label} required={required}>
      <Select value={value || ''} onChange={onChange} options={normalized} placeholder="Selecione..." className="w-full" />
    </FieldShell>
  )
}

export default function ApoicesGestao() {
  const navigate                             = useNavigate()
  const toast                                = useToast()
  const { resolverNome, getAliases } = useImobiliaria()

  const [apolices,       setApolices]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filtro,         setFiltro]         = useState('semana')
  const [imobFiltro,     setImobFiltro]     = useState('')
  const [activeId,       setActiveId]       = useState(null)
  const [modalIniciar,   setModalIniciar]   = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(null)
  const [pendingMove,    setPendingMove]    = useState(null)
  const [collapsed,      setCollapsed]      = useState(new Set())
  const [colOrder,       setColOrder]       = useState(() => {
    try {
      const s = localStorage.getItem('kanban-apolices-col-order')
      if (s) {
        const p = JSON.parse(s)
        if (COLUNAS.every(c => p.includes(c.id)) && p.length === COLUNAS.length) return p
      }
    } catch {}
    return COLUNAS.map(c => c.id)
  })

  const scrollRef    = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const getAliasesRef = useRef(getAliases)
  getAliasesRef.current = getAliases

  const load = useCallback(async () => {
    setLoading(true)
    const [dateFrom, dateTo] = getPeriodDates(filtro)
    let imobiliariasFilter
    if (imobFiltro) {
      const aliases = await getAliasesRef.current(imobFiltro)
      imobiliariasFilter = aliases.length ? aliases : [imobFiltro]
    }
      {/* Kanban */}
    setApolices(data)
    setLoading(false)
  }, [filtro, imobFiltro])

  useEffect(() => { load() }, [load])

  function checkScroll() {
    const el = scrollRef.current; if (!el) return
    setCanScrollL(el.scrollLeft > 5)
    setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
  }
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll); ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [loading])

  const groups = Object.fromEntries(COLUNAS.map(c => [c.id, []]))
  apolices.forEach(a => { if (groups[a.status_emissao] !== undefined) groups[a.status_emissao].push(a) })

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    // Column reorder
    if (active.data.current?.type === 'column') {
      const fromColId = active.data.current.colId
      const toColId   = over.id
      if (fromColId !== toColId && COLUNAS.some(c => c.id === toColId)) {
        setCollapsed(prev => prev) // keep state, just reorder display
        // Persist reorder
        setApolices(prev => [...prev]) // trigger re-render with new colOrder
        setColOrder(prev => {
          const fi = prev.indexOf(fromColId), ti = prev.indexOf(toColId)
          if (fi === -1 || ti === -1) return prev
          const next = [...prev]; next.splice(fi, 1); next.splice(ti, 0, fromColId)
          try { localStorage.setItem('kanban-apolices-col-order', JSON.stringify(next)) } catch {}
          return next
        })
      }
      return
    }

    // Card move
    const id         = active.id
    const novoStatus = over.id
    const apolice    = apolices.find(a => a.id === id)
    if (!apolice || apolice.status_emissao === novoStatus) return
    if (!COLUNAS.some(c => c.id === novoStatus)) return

    if (novoStatus === 'emitida') {
      setPendingMove({ id, fromStatus: apolice.status_emissao })
      setModalFinalizar({ id, apolice })
      return
    }

    setApolices(prev => prev.map(a =>
      a.id === id ? { ...a, status_emissao: novoStatus } : a
    ))
    const err = await moverStatusApolice(id, novoStatus)
    if (err) { toast({ type: 'error', title: 'Erro ao mover ap?lice' }); load() }
  }

  function handleFinalizarSuccess() {
    setPendingMove(null)
    setModalFinalizar(null)
    load()
  }

  function handleFinalizarClose() {
    // Rollback: n?o mover
    setPendingMove(null)
    setModalFinalizar(null)
  }

  function toggleCollapse(colId) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else next.add(colId)
      return next
    })
  }

  const activeCard = (!activeId || activeId.startsWith('col::')) ? null : apolices.find(a => a.id === activeId)

  if (modalIniciar) return (
    <ModalIniciarEmissao onClose={() => setModalIniciar(false)} onCriado={load} toast={toast} />
  )
  if (modalFinalizar) return (
    <ModalFinalizar
      apoliceId={modalFinalizar.id}
      apolice={modalFinalizar.apolice}
      onClose={handleFinalizarClose}
      onFinalizado={handleFinalizarSuccess}
      toast={toast}
    />
  )

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-page text-dark-text">Gest?o de Ap?lices</h1>
          <p className="text-xs text-dark-muted mt-0.5">Arraste as ap?lices entre as colunas para atualizar o status</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-dark-surface2 border border-dark-border rounded-lg p-0.5">
          {['hoje','semana','mes'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      filtro === f ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                    }`}>
              {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ImobiliariaSelect value={imobFiltro} onChange={setImobFiltro} className="text-sm" />
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <button onClick={() => setModalIniciar(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Iniciar Emiss?o</button>
        </div>
      </div>

      {/* Kanban */}
      {!loading && (
        <div className="relative">
          {canScrollL && (
            <>
              <div className="absolute left-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                   style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }} />
              <button onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                      className="absolute left-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
          {canScrollR && (
            <>
              <div className="absolute right-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                   style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }} />
              <button onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                      className="absolute right-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanPointerCollision}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
            >
              <div className="flex gap-3 min-w-max px-1">
                {colOrder.map((colId, i) => {
                  const col = COLUNAS.find(c => c.id === colId)
                  if (!col) return null
                  return (
                    <DroppableColumn
                      key={col.id}
                      col={col}
                      apolices={groups[col.id] || []}
                      onDetalhe={id => navigate(`/apolices/${id}`)}
                      resolverNome={resolverNome}
                      colIndex={i}
                      collapsed={collapsed.has(col.id)}
                      onToggleCollapse={() => toggleCollapse(col.id)}
                    />
                  )
                })}
              </div>
              <DragOverlay dropAnimation={null} modifiers={KANBAN_DRAG_OVERLAY_MODIFIERS}>
                {activeId?.startsWith?.('col::') ? (() => {
                  const cid = activeId.replace('col::', '')
                  const col = COLUNAS.find(c => c.id === cid)
                  if (!col) return null
                  return (
                    <div className="kanban-col flex flex-col" style={{ transform: 'rotate(2deg)', opacity: 0.9, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}>
                      <div className="kanban-col-header" style={{ background: col.color + '20', borderColor: col.color + '60' }}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                          <span className="text-[11px] font-bold" style={{ color: col.color }}>{col.label}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: col.color + '30', color: col.color }}>
                          {groups[cid]?.length ?? 0}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-b-xl border border-t-0 min-h-[60px]" style={{ background: col.color + '06', borderColor: col.color + '30' }}>
                        {(groups[cid] || []).slice(0, 3).map(a => (
                          <div key={a.id} className="text-[10px] text-dark-muted truncate py-1 px-2 rounded-lg mb-1" style={{ background: 'rgb(var(--color-surface2) / 0.6)' }}>
                            {normalizeDisplayText(a.fichas?.nome_interessado || a.nome_interessado) || '?'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })() : activeCard ? (
                  <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none', '--kanban-accent': PRODUTO_COLOR[produtoApolice(activeCard)] || '#4A90D9' }}>
                    <ApoliceCard apolice={activeCard} isDragOverlay resolverNome={resolverNome} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}

    </div>
  )
}
