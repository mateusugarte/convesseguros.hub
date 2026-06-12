import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useComercial, eventAdd, eventUpdate, eventDelete, TIPOS_EVENTO, CORES_EVENTO } from '../../lib/comercial'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../contexts/ToastContext'
import {
  Plus, ChevronLeft, ChevronRight, Trash2, MoreHorizontal,
  Clock, Calendar, Pencil, X,
} from 'lucide-react'
import {
  format, parseISO,
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Helpers ───────────────────────────────────────────────────────────────────

function corEvento(tipo) { return CORES_EVENTO[tipo] || '#6B7280' }

function isoToLocal(iso) {
  if (!iso) return ''
  const d   = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtHora(iso) {
  try { return format(parseISO(iso), 'HH:mm') } catch { return '—' }
}

// ── EventPill ─────────────────────────────────────────────────────────────────

function EventPill({ evento, onClick }) {
  const cor = corEvento(evento.tipo)
  return (
    <button onClick={e => { e.stopPropagation(); onClick(evento) }}
      className="w-full text-left text-[10px] font-semibold px-2 py-1 rounded-xl truncate transition-all hover:opacity-90 hover:-translate-y-[1px] shadow-sm"
      style={{ background: cor + '1F', color: cor, border: `1px solid ${cor}40` }}>
      {fmtHora(evento.data)} {evento.nome}
    </button>
  )
}

// ── MonthView ─────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function MonthView({ date, events, selectedDay, onDaySelect, onEventClick, deletingIds }) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 })
  const end   = endOfWeek(endOfMonth(date),     { weekStartsOn: 0 })
  const days  = eachDayOfInterval({ start, end })

  function dayEvents(d) {
    return events
      .filter(e => !deletingIds.has(e.id))
      .filter(e => { try { return isSameDay(parseISO(e.data), d) } catch { return false } })
      .sort((a, b) => a.data > b.data ? 1 : -1)
  }

  return (
    <div className="glass-panel overflow-hidden rounded-[24px]">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-dark-border">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold text-dark-muted uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const evs      = dayEvents(day)
          const inMonth  = isSameMonth(day, date)
          const todayDay = isToday(day)
          const selected = isSameDay(day, selectedDay)
          return (
            <div key={i} onClick={() => onDaySelect(day)}
              className={`min-h-[110px] p-2 border-r border-b border-dark-border/20 cursor-pointer transition-colors
                ${!inMonth  ? 'opacity-25' : 'hover:bg-white/45'}
                ${selected  ? 'bg-brand-accent/5 border-brand-accent/30' : ''}`}
              style={selected ? { boxShadow: 'inset 0 0 0 1.5px rgba(74,144,217,0.35)' } : {}}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 flex-shrink-0
                ${todayDay ? 'bg-brand-accent text-white' : selected ? 'text-brand-accent' : 'text-dark-muted'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map(e => (
                  <EventPill key={e.id} evento={e} onClick={onEventClick} />
                ))}
                {evs.length > 3 && (
                  <button
                    onClick={ev => { ev.stopPropagation(); onDaySelect(day) }}
                    className="text-[9px] text-brand-accent pl-1 hover:underline">
                    +{evs.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── WeekView ──────────────────────────────────────────────────────────────────

function WeekView({ date, events, onDaySelect, onSlotClick, onEventClick, deletingIds }) {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  const end   = endOfWeek(date,   { weekStartsOn: 0 })
  const days  = eachDayOfInterval({ start, end })
  const hours = Array.from({ length: 14 }, (_, i) => i + 7)

  function slotEvents(day, hour) {
    return events
      .filter(e => !deletingIds.has(e.id))
      .filter(e => {
        try {
          const d = parseISO(e.data)
          return isSameDay(d, day) && d.getHours() === hour
        } catch { return false }
      })
  }

  return (
    <div className="glass-panel overflow-hidden overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid border-b border-dark-border" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
          <div />
          {days.map(d => (
            <button key={d.toString()} onClick={() => onDaySelect(d)}
              className={`px-2 py-2.5 text-center border-l border-dark-border/30 hover:bg-dark-surface2 transition-colors
                ${isToday(d) ? 'bg-brand-accent/5' : ''}`}>
              <p className="text-[10px] text-dark-muted capitalize">{format(d, 'EEE', { locale: ptBR })}</p>
              <p className={`text-sm font-bold ${isToday(d) ? 'text-brand-accent' : 'text-dark-text'}`}>{format(d, 'd')}</p>
            </button>
          ))}
        </div>
        {hours.map(h => (
          <div key={h} className="grid border-b border-dark-border/20" style={{ gridTemplateColumns: '48px repeat(7, 1fr)', minHeight: 40 }}>
            <div className="px-1 py-1 text-[9px] text-dark-muted font-mono flex-shrink-0">{String(h).padStart(2,'0')}h</div>
            {days.map(d => {
              const evs = slotEvents(d, h)
              return (
                <div key={d.toString()} onClick={() => onSlotClick(d, h)}
                  className={`border-l border-dark-border/20 p-1 cursor-pointer hover:bg-white/45 transition-colors min-h-[44px]
                    ${isToday(d) ? 'bg-brand-accent/[0.03]' : ''}`}>
                  {evs.map(e => <EventPill key={e.id} evento={e} onClick={onEventClick} />)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── EventCard (painel lateral) ────────────────────────────────────────────────

function EventCard({ evento, lead, openMenuId, setOpenMenuId, onEdit, onDelete, navigate }) {
  const cor  = corEvento(evento.tipo)
  const open = openMenuId === evento.id
  const ref  = useRef(null)

  useEffect(() => {
    if (!open) return
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpenMenuId(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, setOpenMenuId])

  return (
    <div className="flex gap-2.5 p-3 rounded-2xl border border-dark-border/60 bg-white/45 hover:bg-white/70 transition-all group shadow-sm">
      {/* Color bar */}
      <div className="w-0.5 rounded-full flex-shrink-0 self-stretch" style={{ background: cor }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ color: cor, background: cor + '20' }}>
            {evento.tipo}
          </span>
          <div ref={ref} className="relative flex-shrink-0">
            <button onClick={() => setOpenMenuId(open ? null : evento.id)}
              className="p-1 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface3 transition-colors opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 w-32 glass-modal rounded-2xl shadow-xl z-[300] py-1 overflow-hidden">
                <button onClick={() => { setOpenMenuId(null); onEdit(evento) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-text hover:bg-dark-surface2 text-left transition-colors">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => { setOpenMenuId(null); onDelete(evento.id) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-status-error hover:bg-status-error/10 text-left transition-colors">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-sm font-semibold text-dark-text mt-1 leading-snug">{evento.nome}</p>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-dark-muted flex-wrap">
          <span className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3" />
            {fmtHora(evento.data)}
          </span>
          {lead && (
            <button onClick={() => navigate(`/comercial/leads/${lead.id}`)}
              className="text-brand-accent hover:underline truncate max-w-[120px]">
              {lead.nome}
            </button>
          )}
        </div>

        {evento.descricao && (
          <p className="text-xs text-dark-muted mt-1 line-clamp-2">{evento.descricao}</p>
        )}
      </div>
    </div>
  )
}

// ── PainelDia ─────────────────────────────────────────────────────────────────

function PainelDia({ selectedDay, events, leads, deletingIds, pendingUndo, onAdd, onEdit, onDelete, onUndoDelete, navigate }) {
  const [openMenuId, setOpenMenuId] = useState(null)

  const dayEvents = useMemo(() => (events || [])
    .filter(e => !deletingIds.has(e.id))
    .filter(e => { try { return isSameDay(parseISO(e.data), selectedDay) } catch { return false } })
    .sort((a, b) => a.data > b.data ? 1 : -1),
    [events, selectedDay, deletingIds]
  )

  const dateTitle   = format(selectedDay, "d 'de' MMMM", { locale: ptBR })
  const weekdayName = format(selectedDay, 'EEEE', { locale: ptBR })
  const todayMark   = isToday(selectedDay)

  return (
    <div className="glass-panel p-0 overflow-hidden flex flex-col" style={{ minHeight: 360 }}>
      {/* Header */}
      <div className="modal-shell-header px-4 py-3 border-b border-dark-border/60 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-dark-text capitalize">{dateTitle}</p>
            <p className="text-xs text-dark-muted capitalize">
              {weekdayName}
              {todayMark && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-brand-accent/15 text-brand-accent text-[9px] font-bold">Hoje</span>}
            </p>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-dark-surface2 text-dark-muted flex-shrink-0">
            {dayEvents.length}
          </span>
        </div>
      </div>

      {/* Undo banner */}
      {pendingUndo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-dark-surface2 border-b border-dark-border text-xs flex-shrink-0">
          <span className="text-dark-muted flex-1">Evento removido</span>
          <button onClick={onUndoDelete} className="text-brand-accent font-semibold hover:underline">
            Desfazer
          </button>
        </div>
      )}

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <Calendar className="w-8 h-8 text-dark-muted opacity-25" />
            <p className="text-sm text-dark-muted">Nenhum evento neste dia</p>
            <button onClick={() => onAdd(selectedDay)} className="btn-secondary text-xs mt-1">
              <Plus className="w-3 h-3" /> Criar evento
            </button>
          </div>
        ) : dayEvents.map(ev => {
          const lead = (leads || []).find(l => l.id === ev.leadId)
          return (
            <EventCard
              key={ev.id}
              evento={ev}
              lead={lead}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              onEdit={onEdit}
              onDelete={onDelete}
              navigate={navigate}
            />
          )
        })}
      </div>

      {/* Footer */}
      <div className="modal-shell-footer p-3 border-t border-dark-border/60 flex-shrink-0">
        <button onClick={() => onAdd(selectedDay)}
          className="w-full btn-primary text-sm flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Adicionar ao dia
        </button>
      </div>
    </div>
  )
}

// ── ModalEvento ───────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  '08:00','09:00','10:00','11:00',
  '12:00','13:00','14:00','15:00',
  '16:00','17:00','18:00','19:00','20:00',
]

function ModalEvento({ evento, leads, onClose, onSave, onDelete }) {
  const isEdit = !!evento?.id

  const localStr = isEdit ? isoToLocal(evento.data) : (evento?.data || '')
  const [form, setForm] = useState({
    nome:      isEdit ? (evento.nome      || '') : '',
    tipo:      isEdit ? (evento.tipo      || 'Reunião') : 'Reunião',
    date:      localStr.slice(0, 10) || '',
    time:      localStr.slice(11, 16) || '09:00',
    descricao: isEdit ? (evento.descricao || '') : '',
    leadId:    isEdit ? (evento.leadId    || '') : '',
  })

  const set    = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valido = form.nome.trim() && form.date

  function handleSave() {
    if (!valido) return
    const iso = new Date(form.date + 'T' + form.time).toISOString()
    onSave({ nome: form.nome, tipo: form.tipo, leadId: form.leadId, descricao: form.descricao, data: iso })
  }

  const dateFmt = form.date
    ? (() => { try { return format(parseISO(form.date), "EEEE, d 'de' MMMM", { locale: ptBR }) } catch { return form.date } })()
    : 'Sem data'

  const corTipo = corEvento(form.tipo)

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative glass-modal rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="modal-shell-header flex items-center justify-between px-5 py-4 border-b border-dark-border/60">
          <div>
            <h2 className="font-bold text-dark-text">{isEdit ? 'Editar Evento' : 'Novo Evento'}</h2>
            <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--glass-text-muted)' }}>
              <Calendar className="inline w-3 h-3 mr-1 -mt-px" />{dateFmt}
            </p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="modal-shell-body px-5 py-4 space-y-4 max-h-[72vh] overflow-y-auto">

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
              Título <span className="text-status-error">*</span>
            </label>
            <input
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              className="input w-full"
              autoFocus
              placeholder="Ex: Reunião de alinhamento"
            />
          </div>

          {/* Tipo + Lead */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Tipo</label>
              <Select value={form.tipo} onChange={v => set('tipo', v)}
                options={TIPOS_EVENTO.map(t => ({ value: t, label: t }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Lead</label>
              <Select value={form.leadId} onChange={v => set('leadId', v)}
                placeholder="Nenhum"
                options={[{ value: '', label: 'Nenhum' }, ...(leads || []).map(l => ({ value: l.id, label: l.nome }))]} />
            </div>
          </div>

          {/* Horário */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">
              <Clock className="inline w-3 h-3 mr-1 -mt-px" />Horário
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {TIME_SLOTS.map(slot => {
                const active = form.time === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => set('time', slot)}
                    style={{
                      padding: '9px 4px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: active ? 700 : 400,
                      border: active
                        ? `1.5px solid ${corTipo}90`
                        : '1.5px solid var(--glass-border)',
                      background: active
                        ? corTipo + '22'
                        : 'transparent',
                      color: active ? corTipo : 'var(--glass-text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-dark-muted whitespace-nowrap">Ou digitar:</span>
              <input
                type="time"
                value={form.time}
                onChange={e => set('time', e.target.value)}
                className="input text-sm"
                style={{ width: 110, padding: '5px 10px' }}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Notas</label>
            <textarea
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              rows={2}
              className="input w-full resize-none text-sm"
              placeholder="Observações opcionais..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-shell-footer flex items-center gap-2 px-5 py-4 border-t border-dark-border/60">
          {isEdit && (
            <button
              onClick={() => onDelete(evento.id)}
              className="p-2 rounded-xl bg-status-error/10 text-status-error hover:bg-status-error/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={!valido} className="btn-primary flex-1 text-sm">
            {isEdit ? 'Salvar' : 'Criar Evento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const VIEWS = ['Mês', 'Semana']

export default function Calendario() {
  const state    = useComercial()
  const toast    = useToast()
  const navigate = useNavigate()

  const [view,        setView]        = useState('Mês')
  const [date,        setDate]        = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [modal,       setModal]       = useState(null) // null | {} | evento

  // Undo delete
  const [deletingIds,  setDeletingIds]  = useState(new Set())
  const [pendingUndo,  setPendingUndo]  = useState(null)
  const undoTimerRef = useRef(null)

  const title = useMemo(() => {
    if (view === 'Mês') {
      const t = format(date, 'MMMM yyyy', { locale: ptBR })
      return t.charAt(0).toUpperCase() + t.slice(1)
    }
    const s = startOfWeek(date, { weekStartsOn: 0 })
    const e = endOfWeek(date,   { weekStartsOn: 0 })
    return `${format(s,'d MMM',{locale:ptBR})} – ${format(e,'d MMM yyyy',{locale:ptBR})}`
  }, [date, view])

  function nav(dir) {
    if (view === 'Mês')    setDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1))
    if (view === 'Semana') setDate(d => dir > 0 ? addWeeks(d, 1)  : subWeeks(d, 1))
  }

  function openNew(day, hour = 9) {
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    setSelectedDay(d)
    setModal({ data: format(d, "yyyy-MM-dd'T'HH:mm") })
  }

  async function handleSave(form) {
    try {
      if (modal?.id) await eventUpdate(modal.id, form)
      else           await eventAdd(form)
      toast({ type: 'success', title: modal?.id ? 'Evento atualizado' : 'Evento criado' })
    } catch {
      toast({ type: 'error', title: 'Erro ao salvar' })
    }
    setModal(null)
  }

  function handleDeleteEvent(id) {
    setDeletingIds(prev => new Set([...prev, id]))
    setPendingUndo({ id })
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => {
      eventDelete(id)
      setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n })
      setPendingUndo(null)
    }, 5000)
  }

  function handleUndoDelete() {
    if (!pendingUndo) return
    clearTimeout(undoTimerRef.current)
    setDeletingIds(prev => { const n = new Set(prev); n.delete(pendingUndo.id); return n })
    setPendingUndo(null)
    toast({ type: 'success', title: 'Evento restaurado' })
  }

  function handleDeleteFromModal(id) {
    setModal(null)
    handleDeleteEvent(id)
  }

  function handleDaySelect(day) {
    setSelectedDay(day)
    setDate(day)
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Barra superior ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="title-page text-dark-text">Calendário</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Navegação */}
          <div className="flex items-center gap-1">
            <button onClick={() => nav(-1)}
              className="p-1.5 rounded-xl border border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-dark-text min-w-[170px] text-center text-sm capitalize">
              {title}
            </span>
            <button onClick={() => nav(1)}
              className="p-1.5 rounded-xl border border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => { setDate(new Date()); setSelectedDay(new Date()) }}
            className="text-xs text-dark-muted hover:text-dark-text border border-dark-border px-2.5 py-1.5 rounded-xl transition-colors">
            Hoje
          </button>

          {/* View toggle */}
          <div className="flex bg-dark-surface2 rounded-xl p-0.5">
            {VIEWS.map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${view === v ? 'bg-dark-glass text-dark-text shadow-sm' : 'text-dark-muted hover:text-dark-text'}`}>
                {v}
              </button>
            ))}
          </div>

          <button onClick={() => openNew(selectedDay)}
            className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Novo Evento
          </button>
        </div>
      </div>

      {/* ── Layout 70/30 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_296px] gap-4 items-start">
        {/* Calendar grid */}
        <div>
          {view === 'Mês' && (
            <MonthView
              date={date}
              events={state.events || []}
              selectedDay={selectedDay}
              onDaySelect={handleDaySelect}
              onEventClick={setModal}
              deletingIds={deletingIds}
            />
          )}
          {view === 'Semana' && (
            <WeekView
              date={date}
              events={state.events || []}
              onDaySelect={handleDaySelect}
              onSlotClick={openNew}
              onEventClick={setModal}
              deletingIds={deletingIds}
            />
          )}
        </div>

        {/* Side panel */}
        <div className="lg:sticky lg:top-4">
          <PainelDia
            selectedDay={selectedDay}
            events={state.events || []}
            leads={state.leads  || []}
            deletingIds={deletingIds}
            pendingUndo={pendingUndo}
            onAdd={openNew}
            onEdit={setModal}
            onDelete={handleDeleteEvent}
            onUndoDelete={handleUndoDelete}
            navigate={navigate}
          />
        </div>
      </div>

      {/* ── Modal overlay ──────────────────────────────────────────────────── */}
      {modal !== null && (
        <ModalEvento
          evento={modal}
          leads={state.leads || []}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDeleteFromModal}
        />
      )}
    </div>
  )
}
