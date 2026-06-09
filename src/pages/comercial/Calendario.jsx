import { useState, useMemo } from 'react'
import { useComercial, eventAdd, eventUpdate, eventDelete, TIPOS_EVENTO, CORES_EVENTO } from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import { Plus, ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks, eachHourOfInterval,
  startOfDay, endOfDay, setHours
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const VIEWS = ['Mês', 'Semana', 'Dia']

function corEvento(tipo) { return CORES_EVENTO[tipo] || '#6366F1' }

function isoToLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Evento Modal ──────────────────────────────────────────────────────────────

function ModalEvento({ evento, leads, onClose, onSave, onDelete }) {
  const isEdit = !!evento?.id
  const [form, setForm] = useState(() => isEdit ? {
    nome: evento.nome || '', tipo: evento.tipo || 'Reunião',
    data: isoToLocal(evento.data),
    descricao: evento.descricao || '', leadId: evento.leadId || '',
  } : {
    nome: '', tipo: 'Reunião', data: evento?.data || '',
    descricao: '', leadId: '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valido = form.nome.trim() && form.data

  return (
    <div className="animate-fade-in">
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-dark-text">{isEdit ? 'Editar Evento' : 'Novo Evento'}</h2>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Título *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} className="input" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="select w-full">
                {TIPOS_EVENTO.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Data/Hora *</label>
              <input type="datetime-local" value={form.data} onChange={e => set('data', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Lead Vinculado</label>
            <select value={form.leadId} onChange={e => set('leadId', e.target.value)} className="select w-full">
              <option value="">Nenhum</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} className="input resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            {isEdit && <button onClick={() => onDelete(evento.id)} className="px-3 py-2 rounded-lg bg-status-error/10 text-status-error hover:bg-status-error/20 transition-colors"><Trash2 className="w-4 h-4" /></button>}
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => valido && onSave({ ...form, data: new Date(form.data).toISOString() })} disabled={!valido} className="btn-primary flex-1">
              {isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pill ──────────────────────────────────────────────────────────────────────

function EventPill({ evento, onClick }) {
  const cor = corEvento(evento.tipo)
  return (
    <button onClick={e => { e.stopPropagation(); onClick(evento) }}
      className="w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded truncate transition-opacity hover:opacity-80"
      style={{ background: cor + '30', color: cor, border: `1px solid ${cor}50` }}>
      {format(parseISO(evento.data), 'HH:mm')} {evento.nome}
    </button>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ date, events, onDayClick, onEventClick }) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 })
  const end   = endOfWeek(endOfMonth(date), { weekStartsOn: 0 })
  const days  = eachDayOfInterval({ start, end })
  const dias  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

  function dayEvents(d) {
    return events.filter(e => { try { return isSameDay(parseISO(e.data), d) } catch { return false } })
      .sort((a,b) => a.data > b.data ? 1 : -1)
  }

  return (
    <div className="glass-panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-dark-border">
        {dias.map(d => <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-dark-muted">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const evs = dayEvents(day)
          const inMonth = isSameMonth(day, date)
          const today   = isToday(day)
          return (
            <div key={i} onClick={() => onDayClick(day)}
              className={`min-h-[90px] p-1.5 border-r border-b border-dark-border/40 cursor-pointer hover:bg-dark-surface2 transition-colors ${!inMonth ? 'opacity-30' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${today ? 'bg-brand-accent text-white' : 'text-dark-muted'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0,3).map(e => <EventPill key={e.id} evento={e} onClick={onEventClick} />)}
                {evs.length > 3 && <p className="text-[9px] text-dark-muted pl-1">+{evs.length - 3} mais</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ date, events, onSlotClick, onEventClick }) {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  const end   = endOfWeek(date, { weekStartsOn: 0 })
  const days  = eachDayOfInterval({ start, end })
  const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7h–20h

  function slotEvents(day, hour) {
    return events.filter(e => {
      try {
        const d = parseISO(e.data)
        return isSameDay(d, day) && d.getHours() === hour
      } catch { return false }
    })
  }

  return (
    <div className="glass-panel overflow-hidden overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="grid border-b border-dark-border" style={{ gridTemplateColumns: '50px repeat(7, 1fr)' }}>
          <div />
          {days.map(d => (
            <div key={d.toString()} className={`px-2 py-2 text-center border-l border-dark-border/40 ${isToday(d) ? 'bg-brand-accent/5' : ''}`}>
              <p className="text-xs text-dark-muted">{format(d, 'EEE', { locale: ptBR })}</p>
              <p className={`text-sm font-bold ${isToday(d) ? 'text-brand-accent' : 'text-dark-text'}`}>{format(d, 'd')}</p>
            </div>
          ))}
        </div>
        {/* Time grid */}
        {hours.map(h => (
          <div key={h} className="grid border-b border-dark-border/20" style={{ gridTemplateColumns: '50px repeat(7, 1fr)', minHeight: 40 }}>
            <div className="px-1 py-1 text-[9px] text-dark-muted font-mono">{String(h).padStart(2,'0')}:00</div>
            {days.map(d => {
              const evs = slotEvents(d, h)
              return (
                <div key={d.toString()} onClick={() => onSlotClick(d, h)}
                  className={`border-l border-dark-border/20 p-0.5 cursor-pointer hover:bg-dark-surface2 transition-colors ${isToday(d) ? 'bg-brand-accent/3' : ''}`}>
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

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({ date, events, onSlotClick, onEventClick }) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7)
  const dayEvs = events.filter(e => { try { return isSameDay(parseISO(e.data), date) } catch { return false } })
    .sort((a,b) => a.data > b.data ? 1 : -1)

  function slotEvs(h) { return dayEvs.filter(e => { try { return parseISO(e.data).getHours() === h } catch { return false } }) }

  return (
    <div className="glass-panel overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-border">
        <p className="font-semibold text-dark-text">{format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        <p className="text-xs text-dark-muted">{dayEvs.length} eventos</p>
      </div>
      <div className="overflow-y-auto max-h-[500px]">
        {hours.map(h => {
          const evs = slotEvs(h)
          return (
            <div key={h} onClick={() => onSlotClick(date, h)}
              className="flex gap-3 border-b border-dark-border/20 px-4 py-2 cursor-pointer hover:bg-dark-surface2 min-h-[44px] transition-colors">
              <span className="text-xs font-mono text-dark-muted w-10 flex-shrink-0">{String(h).padStart(2,'0')}:00</span>
              <div className="flex-1 space-y-1">
                {evs.map(e => (
                  <div key={e.id} onClick={ev => { ev.stopPropagation(); onEventClick(e) }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
                    style={{ background: corEvento(e.tipo) + '20', borderLeft: `3px solid ${corEvento(e.tipo)}` }}>
                    <span className="text-xs font-semibold" style={{ color: corEvento(e.tipo) }}>{e.nome}</span>
                    {e.descricao && <span className="text-[10px] text-dark-muted truncate">{e.descricao}</span>}
                    <span className="ml-auto text-[9px] font-semibold" style={{ color: corEvento(e.tipo) }}>{e.tipo}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Calendario() {
  const state = useComercial()
  const toast = useToast()
  const [view, setView]   = useState('Mês')
  const [date, setDate]   = useState(new Date())
  const [modal, setModal] = useState(null)

  const title = useMemo(() => {
    if (view === 'Mês')   return format(date, 'MMMM yyyy', { locale: ptBR })
    if (view === 'Semana') {
      const s = startOfWeek(date, { weekStartsOn: 0 })
      const e = endOfWeek(date, { weekStartsOn: 0 })
      return `${format(s,'d MMM',{locale:ptBR})} – ${format(e,'d MMM yyyy',{locale:ptBR})}`
    }
    return format(date, "d 'de' MMMM yyyy", { locale: ptBR })
  }, [date, view])

  function nav(dir) {
    if (view === 'Mês')    setDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1))
    if (view === 'Semana') setDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1))
    if (view === 'Dia')    setDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + dir); return nd })
  }

  function openNew(day, hour = 9) {
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    setModal({ data: format(d, "yyyy-MM-dd'T'HH:mm") })
  }

  async function handleSave(form) {
    try {
      if (modal?.id) { await eventUpdate(modal.id, form) }
      else           { await eventAdd(form) }
      toast({ type: 'success', title: modal?.id ? 'Evento atualizado!' : 'Evento criado!' })
    } catch {
      toast({ type: 'error', title: 'Erro ao salvar evento' })
    }
    setModal(null)
  }

  if (modal) return (
    <ModalEvento
      evento={modal}
      leads={state.leads}
      onClose={() => setModal(null)}
      onSave={handleSave}
      onDelete={id => { eventDelete(id); setModal(null) }}
    />
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="btn-secondary p-1.5"><ChevronLeft className="w-4 h-4" /></button>
          <h2 className="font-bold text-dark-text min-w-[180px] text-center capitalize">{title}</h2>
          <button onClick={() => nav(1)}  className="btn-secondary p-1.5"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setDate(new Date())} className="text-xs text-dark-muted hover:text-dark-text border border-dark-border px-2 py-1 rounded-lg">Hoje</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-dark-surface2 rounded-lg p-0.5">
            {VIEWS.map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view === v ? 'bg-dark-glass text-dark-text shadow-sm' : 'text-dark-muted'}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => openNew(new Date())} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Evento
          </button>
        </div>
      </div>

      {view === 'Mês'    && <MonthView date={date} events={state.events} onDayClick={d => { setDate(d); setView('Dia') }} onEventClick={setModal} />}
      {view === 'Semana' && <WeekView  date={date} events={state.events} onSlotClick={openNew} onEventClick={setModal} />}
      {view === 'Dia'    && <DayView   date={date} events={state.events} onSlotClick={openNew} onEventClick={setModal} />}

    </div>
  )
}
