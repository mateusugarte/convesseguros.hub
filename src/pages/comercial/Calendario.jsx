import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useComercial, eventAdd, eventUpdate, eventDelete, TIPOS_EVENTO, CORES_EVENTO } from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import {
  Plus, ChevronLeft, ChevronRight, Trash2, MoreHorizontal,
  Clock, Calendar, Pencil, X, BellRing, ListTodo, Users, Search, Check,
} from 'lucide-react'
import {
  format, parseISO,
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths, addDays, subDays,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CrmMetricCard, CrmPageHeader, CrmSectionCard, CrmSegmentedControl } from '../../components/comercial'

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
      .sort((a, b) => a.data > b.data  1 : -1)
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
                ${!inMonth   'opacity-25' : 'hover:bg-white/45'}
                ${selected   'bg-brand-accent/5 border-brand-accent/30' : ''}`}
              style={selected  { boxShadow: 'inset 0 0 0 1.5px rgba(74,144,217,0.35)' } : {}}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 flex-shrink-0
                ${todayDay  'bg-brand-accent text-white' : selected  'text-brand-accent' : 'text-dark-muted'}`}>
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
                ${isToday(d)  'bg-brand-accent/5' : ''}`}>
              <p className="text-[10px] text-dark-muted capitalize">{format(d, 'EEE', { locale: ptBR })}</p>
              <p className={`text-sm font-bold ${isToday(d)  'text-brand-accent' : 'text-dark-text'}`}>{format(d, 'd')}</p>
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
                    ${isToday(d)  'bg-brand-accent/[0.03]' : ''}`}>
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

function DayView({ date, events, onSlotClick, onEventClick, deletingIds }) {
  const hours = Array.from({ length: 14 }, (_, index) => index + 7)
  const dayEvents = (events || [])
    .filter(event => !deletingIds.has(event.id))
    .filter(event => {
      try { return isSameDay(parseISO(event.data), date) } catch { return false }
    })
    .sort((a, b) => a.data.localeCompare(b.data))

  return (
    <div className="glass-panel overflow-hidden rounded-[24px]">
      <div className="border-b border-dark-border/60 px-4 py-4">
        <p className="text-lg font-semibold capitalize text-dark-text">{format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        <p className="mt-1 text-sm text-dark-muted">{dayEvents.length} evento(s) nesta agenda diária</p>
      </div>
      <div className="divide-y divide-dark-border/20">
        {hours.map(hour => {
          const slotEvents = dayEvents.filter(event => {
            try { return parseISO(event.data).getHours() === hour } catch { return false }
          })
          return (
            <div key={hour} className="grid min-h-[72px] grid-cols-[70px_1fr] gap-0">
              <button
                type="button"
                onClick={() => onSlotClick(date, hour)}
                className="border-r border-dark-border/20 px-4 py-4 text-left text-xs font-semibold text-dark-muted transition-colors hover:bg-white/40"
              >
                {String(hour).padStart(2, '0')}:00
              </button>
              <div className="px-3 py-3">
                {slotEvents.length > 0  (
                  <div className="space-y-2">
                    {slotEvents.map(event => (
                      <EventPill key={event.id} evento={event} onClick={onEventClick} />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSlotClick(date, hour)}
                    className="rounded-xl border border-dashed border-dark-border/60 px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent"
                  >
                    Adicionar evento
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
            <button onClick={() => setOpenMenuId(open  null : evento.id)}
              className="p-1 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface3 transition-colors opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 w-32 glass-modal rounded-2xl shadow-none z-[300] py-1 overflow-hidden">
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
    .sort((a, b) => a.data > b.data  1 : -1),
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
        {dayEvents.length === 0  (
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

function leadInitials(nome) {
  return (nome || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || 'LD'
}

function EventLeadSelect({ leads, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const selectedLead = useMemo(
    () => (leads || []).find(lead => String(lead.id) === String(value)) || null,
    [leads, value],
  )

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return leads || []
    return (leads || []).filter(lead => {
      const nome = (lead.nome || '').toLowerCase()
      const imobiliaria = (lead.imobiliaria || '').toLowerCase()
      return nome.includes(term) || imobiliaria.includes(term)
    })
  }, [leads, search])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event) {
      if (!ref.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(nextValue) {
    onChange(nextValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
          open
             'border-brand-accent/50 bg-brand-accent/5 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
            : 'border-dark-border/70 bg-white/75 hover:border-brand-accent/35'
        }`}
      >
        {selectedLead  (
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #2563EB)' }}
            >
              {leadInitials(selectedLead.nome)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-dark-text">{selectedLead.nome}</p>
              <p className="truncate text-xs text-dark-muted">{selectedLead.imobiliaria || 'Lead sem imobiliária vinculada'}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-dark-text">Nenhum lead vinculado</p>
            <p className="text-xs text-dark-muted">Use quando o evento for geral ou interno.</p>
          </div>
        )}
      </button>

      {open && (
        <div className="rounded-[20px] border border-dark-border/70 bg-white/90 p-2 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-md">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-muted" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar lead ou imobiliária..."
              className="input w-full pl-9 text-sm"
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                !value  'bg-brand-accent/10 text-brand-accent' : 'hover:bg-dark-surface2/70'
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-dark-surface2 text-[10px] font-bold text-dark-muted">
                --
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Nenhum lead</p>
                <p className="text-xs text-dark-muted">Evento sem relacionamento direto com um lead.</p>
              </div>
              {!value && <Check className="h-4 w-4 flex-shrink-0" />}
            </button>

            {filteredLeads.map(lead => {
              const active = String(lead.id) === String(value)
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => handleSelect(lead.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                    active  'bg-brand-accent/10 text-brand-accent' : 'hover:bg-dark-surface2/70'
                  }`}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-bold text-white"
                    style={{ background: active  'linear-gradient(135deg, #2563EB, #4F46E5)' : 'linear-gradient(135deg, #64748B, #475569)' }}
                  >
                    {leadInitials(lead.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{lead.nome}</p>
                    <p className={`truncate text-xs ${active  'text-brand-accent/80' : 'text-dark-muted'}`}>
                      {lead.imobiliaria || 'Sem imobiliária'}
                    </p>
                  </div>
                  {active && <Check className="h-4 w-4 flex-shrink-0" />}
                </button>
              )
            })}

            {filteredLeads.length === 0 && (
              <div className="rounded-2xl border border-dashed border-dark-border/70 px-3 py-5 text-center text-sm text-dark-muted">
                Nenhum lead encontrado para essa busca.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ModalEvento({ evento, leads, onClose, onSave, onDelete }) {
  const isEdit = !!evento.id

  const localStr = isEdit  isoToLocal(evento.data) : (evento.data || '')
  const [form, setForm] = useState({
    nome:      isEdit  (evento.nome      || '') : '',
    tipo:      isEdit  (evento.tipo      || 'Reunião') : 'Reunião',
    date:      localStr.slice(0, 10) || '',
    time:      localStr.slice(11, 16) || '09:00',
    descricao: isEdit  (evento.descricao || '') : '',
    leadId:    isEdit  (evento.leadId    || '') : '',
  })

  const set    = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valido = form.nome.trim() && form.date

  function handleSave() {
    if (!valido) return
    const iso = new Date(form.date + 'T' + form.time).toISOString()
    onSave({ nome: form.nome, tipo: form.tipo, leadId: form.leadId, descricao: form.descricao, data: iso })
  }

  const dateFmt = form.date
     (() => { try { return format(parseISO(form.date), "EEEE, d 'de' MMMM", { locale: ptBR }) } catch { return form.date } })()
    : 'Sem data'

  const corTipo = corEvento(form.tipo)
  const selectedLead = (leads || []).find(lead => String(lead.id) === String(form.leadId))

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative z-10 glass-modal rounded-[24px] w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="modal-shell-header flex items-center justify-between px-5 py-4 border-b border-dark-border/60">
          <div>
            <h2 className="font-bold text-dark-text">{isEdit  'Editar Evento' : 'Novo Evento'}</h2>
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

          <div
            className="rounded-[20px] border px-4 py-3"
            style={{ borderColor: `${corTipo}35`, background: `${corTipo}0E` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: corTipo }}>
                  Resumo do evento
                </p>
                <p className="mt-1 text-sm font-semibold text-dark-text">
                  {form.nome.trim() || 'Evento sem título definido'}
                </p>
                <p className="mt-1 text-xs text-dark-muted">
                  {form.tipo} às {form.time}
                  {selectedLead  ` com ${selectedLead.nome}` : ' sem lead vinculado'}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ color: corTipo, background: `${corTipo}22` }}
              >
                {form.tipo}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Tipo</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TIPOS_EVENTO.map(tipo => {
                const active = form.tipo === tipo
                const color = corEvento(tipo)
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => set('tipo', tipo)}
                    className="rounded-2xl border px-3 py-3 text-left transition-all"
                    style={{
                      borderColor: active  `${color}80` : 'var(--glass-border)',
                      background: active  `${color}18` : 'rgba(255,255,255,0.7)',
                      boxShadow: active  `0 0 0 2px ${color}20` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      <p className="text-sm font-semibold" style={{ color: active  color : 'var(--glass-text-primary)' }}>
                        {tipo}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Lead</label>
            <EventLeadSelect
              leads={leads || []}
              value={form.leadId}
              onChange={v => set('leadId', v)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
                Data <span className="text-status-error">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Hora atual</label>
              <div className="input flex items-center text-sm text-dark-text">
                {form.time}
              </div>
            </div>
          </div>

          {/* Horário */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">
              <Clock className="inline w-3 h-3 mr-1 -mt-px" />Horário
            </label>
            <div className="mb-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
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
                      fontWeight: active  700 : 400,
                      border: active
                         `1.5px solid ${corTipo}90`
                        : '1.5px solid var(--glass-border)',
                      background: active
                         corTipo + '22'
                        : 'transparent',
                      color: active  corTipo : 'var(--glass-text-primary)',
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
            {isEdit  'Salvar' : 'Criar Evento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const VIEWS = [
  { value: 'Dia', label: 'Diária' },
  { value: 'Semana', label: 'Semanal' },
  { value: 'Mês', label: 'Mensal' },
]

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
    if (view === 'Dia') {
      const t = format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
      return t.charAt(0).toUpperCase() + t.slice(1)
    }
    if (view === 'Mês') {
      const t = format(date, 'MMMM yyyy', { locale: ptBR })
      return t.charAt(0).toUpperCase() + t.slice(1)
    }
    const s = startOfWeek(date, { weekStartsOn: 0 })
    const e = endOfWeek(date,   { weekStartsOn: 0 })
    return `${format(s,'d MMM',{locale:ptBR})} – ${format(e,'d MMM yyyy',{locale:ptBR})}`
  }, [date, view])

  function nav(dir) {
    if (view === 'Dia') {
      setDate(d => dir > 0  addDays(d, 1) : subDays(d, 1))
      setSelectedDay(d => dir > 0  addDays(d, 1) : subDays(d, 1))
    }
    if (view === 'Mês')    setDate(d => dir > 0  addMonths(d, 1) : subMonths(d, 1))
    if (view === 'Semana') setDate(d => dir > 0  addWeeks(d, 1)  : subWeeks(d, 1))
  }

  function openNew(day, hour = 9) {
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    setSelectedDay(d)
    setModal({ data: format(d, "yyyy-MM-dd'T'HH:mm") })
  }

  async function handleSave(form) {
    try {
      if (modal.id) await eventUpdate(modal.id, form)
      else           await eventAdd(form)
      toast({ type: 'success', title: modal.id  'Evento atualizado' : 'Evento criado' })
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

  const events = state.events || []
  const todayCount = events.filter(event => { try { return isToday(parseISO(event.data)) } catch { return false } }).length
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
  const weekCount = events.filter(event => {
    try {
      const when = parseISO(event.data)
      return when >= weekStart && when <= weekEnd
    } catch { return false }
  }).length
  const meetingsCount = events.filter(event => event.tipo === 'Reunião').length
  const followUpCount = events.filter(event => event.tipo === 'Follow Up').length

  return (
    <div className="space-y-5 animate-fade-in">
      <CrmPageHeader
        eyebrow="Agenda comercial"
        title="Calendário de execução e follow-up"
        description="Visões diária, semanal e mensal para reuniões, follow-ups, compromissos e tarefas da operação comercial."
        aside={(
          <div className="rounded-[24px] border border-dark-border/60 bg-white/70 px-4 py-3 text-sm shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-muted">Janela atual</p>
            <p className="mt-1 font-semibold capitalize text-dark-text">{title}</p>
            <p className="mt-1 text-xs text-dark-muted">{weekCount} evento(s) nesta semana móvel</p>
          </div>
        )}
        actions={(
          <>
            <button onClick={() => { setDate(new Date()); setSelectedDay(new Date()) }}
              className="btn-secondary text-sm">
              Hoje
            </button>
            <button onClick={() => openNew(selectedDay)}
              className="btn-primary text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Novo evento
              </span>
            </button>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CrmMetricCard icon={BellRing} label="Hoje" value={todayCount} accent="#2563EB" helper="Atividades programadas para hoje" />
        <CrmMetricCard icon={Calendar} label="Semana" value={weekCount} accent="#0F766E" helper="Eventos dentro da semana atual" />
        <CrmMetricCard icon={Users} label="Reuniões" value={meetingsCount} accent="#7C3AED" helper="Agenda total de reuniões" />
        <CrmMetricCard icon={ListTodo} label="Follow-up" value={followUpCount} accent="#D97706" helper="Eventos de acompanhamento" />
      </div>

      <CrmSectionCard
        title="Planner comercial"
        subtitle="Navegue por períodos, mude a granularidade e organize a agenda da equipe."
        action={(
          <div className="flex items-center gap-2">
            <button onClick={() => nav(-1)}
              className="p-1.5 rounded-xl border border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-[170px] text-center text-sm font-semibold capitalize text-dark-text">{title}</span>
            <button onClick={() => nav(1)}
              className="p-1.5 rounded-xl border border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        contentClassName="p-5 pt-0"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <CrmSegmentedControl options={VIEWS} value={view} onChange={setView} />
        </div>

        <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-[1fr_296px]">
          <div>
            {view === 'Mês' && (
              <MonthView
                date={date}
                events={events}
                selectedDay={selectedDay}
                onDaySelect={handleDaySelect}
                onEventClick={setModal}
                deletingIds={deletingIds}
              />
            )}
            {view === 'Semana' && (
              <WeekView
                date={date}
                events={events}
                onDaySelect={handleDaySelect}
                onSlotClick={openNew}
                onEventClick={setModal}
                deletingIds={deletingIds}
              />
            )}
            {view === 'Dia' && (
              <DayView
                date={selectedDay}
                events={events}
                onSlotClick={openNew}
                onEventClick={setModal}
                deletingIds={deletingIds}
              />
            )}
          </div>

          <div className="lg:sticky lg:top-4">
            <PainelDia
              selectedDay={selectedDay}
              events={events}
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
      </CrmSectionCard>

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
