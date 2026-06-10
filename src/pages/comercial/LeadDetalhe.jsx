import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useComercial, leadUpdate, leadMover, eventAdd, eventUpdate, eventDelete,
  PIPELINE_COLS, TIPOS_EVENTO, ORIGENS, calcScore, scoreFaixa, diffDias,
  fetchFichasParaImport,
} from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import { Select } from '../../components/ui/Select'
import {
  ArrowLeft, MessageCircle, ChevronDown, Check, Flame, Sun, Snowflake,
  Building2, Clock, Plus, Trash2, PhoneCall, Users, FileText, ArrowRight,
  CheckSquare, Square, Loader2, ExternalLink, Tag, Calendar, AlertCircle,
  MoreHorizontal, Pencil, X,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#2B5BA8','#EC4899','#06B6D4','#EF4444']

function avatarColor(name) {
  return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}
function fmtDate(iso) {
  try { return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return '—' }
}
function fmtDateShort(iso) {
  try { return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }) } catch { return '—' }
}

const TIPO_ICONS = {
  'Reunião':    Users,
  'Ligação':    PhoneCall,
  'Prospecção': MoreHorizontal,
  'Follow Up':  ArrowRight,
  'Tarefa':     CheckSquare,
  'Nota':       FileText,
}

const SCORE_CONVES = [
  { id: 'A', label: 'A', desc: 'Prioridade máxima — abordar em até 24h', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  { id: 'B', label: 'B', desc: 'Alta prioridade — abordar em até 3 dias', color: '#4A90D9', bg: 'rgba(74,144,217,0.1)' },
  { id: 'C', label: 'C', desc: 'Média prioridade — semana atual', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  { id: 'D', label: 'D', desc: 'Baixa prioridade — mês atual', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
]

// ── ModalEditLead ─────────────────────────────────────────────────────────────

function ModalEditLead({ lead, onClose, toast }) {
  const [form, setForm] = useState({
    nome:          lead.nome          || '',
    telefone:      lead.telefone      || '',
    tipo:          lead.tipo          || 'PF',
    origem:        lead.origem        || '',
    imobiliaria:   lead.imobiliaria   || '',
    nomeApolice:   lead.nomeApolice   || '',
    tipoLocatario: lead.tipoLocatario || '',
    proximaAcao:   lead.proximaAcao   || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    setSaving(true)
    await leadUpdate(lead.id, form)
    toast({ type: 'success', title: 'Lead atualizado' })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-modal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text">Editar Lead</h2>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Nome</label>
              <input value={form.nome} onChange={e => set('nome', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Telefone</label>
              <input value={form.telefone} onChange={e => set('telefone', e.target.value)} className="input text-sm w-full" placeholder="(99) 99999-9999" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Tipo</label>
              <div className="flex gap-2">
                {['PF','PJ'].map(t => (
                  <button key={t} onClick={() => set('tipo', t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                      ${form.tipo === t ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-dark-border text-dark-muted hover:border-dark-text/40'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Origem</label>
              <Select
                value={form.origem}
                onChange={v => set('origem', v)}
                placeholder="Selecionar"
                options={[{ value: '', label: 'Selecionar' }, ...ORIGENS.map(o => ({ value: o, label: o }))]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Imobiliária</label>
              <input value={form.imobiliaria} onChange={e => set('imobiliaria', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Nome Apólice</label>
              <input value={form.nomeApolice} onChange={e => set('nomeApolice', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Tipo Locatário</label>
              <input value={form.tipoLocatario} onChange={e => set('tipoLocatario', e.target.value)} className="input text-sm w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">Próxima Ação</label>
              <input value={form.proximaAcao} onChange={e => set('proximaAcao', e.target.value)} className="input text-sm w-full" placeholder="Ex: Ligar amanhã" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PipelineFunnel ────────────────────────────────────────────────────────────

function PipelineFunnel({ lead, onMove }) {
  const colIdx = PIPELINE_COLS.findIndex(c => c.id === lead.coluna)

  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-0 overflow-x-auto">
        {PIPELINE_COLS.map((col, i) => {
          const isPast    = i < colIdx
          const isCurrent = i === colIdx
          return (
            <div key={col.id} className="flex items-center flex-1 min-w-0">
              {i > 0 && (
                <div className="flex-1 h-px flex-shrink-0"
                  style={{ background: isPast ? '#10B981' : 'var(--glass-border)', minWidth: 8 }} />
              )}
              <button
                onClick={() => !isCurrent && onMove(col, i)}
                disabled={isCurrent}
                title={col.label}
                className={`flex flex-col items-center gap-1 group flex-shrink-0 ${isCurrent ? 'cursor-default' : 'cursor-pointer'}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${isCurrent ? 'ring-2 ring-offset-2 ring-brand-accent' : 'group-hover:ring-1 group-hover:ring-brand-accent/40'}
                    ${isCurrent ? 'animate-pulse' : ''}`}
                  style={{
                    background: isPast ? '#10B981' : isCurrent ? col.color : 'var(--glass-bg)',
                    border: !isPast && !isCurrent ? '1px solid var(--glass-border)' : 'none',
                  }}>
                  {isPast
                    ? <Check className="w-3.5 h-3.5 text-white" />
                    : isCurrent
                      ? <div className="w-3 h-3 rounded-full bg-white" />
                      : <div className="w-2 h-2 rounded-full" style={{ background: col.color + '60' }} />}
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight whitespace-nowrap
                  ${isCurrent ? 'text-dark-text font-bold' : 'text-dark-muted'}`}>
                  {col.label}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Sidebar Cards ─────────────────────────────────────────────────────────────

function CardTemperatura({ lead }) {
  const score = calcScore(lead)
  const f     = scoreFaixa(score)
  const dias  = lead.ultimaAtividade ? diffDias(lead.ultimaAtividade) : null
  const diasP = lead.criadoEm       ? diffDias(lead.criadoEm)        : null
  const TempIcon = score > 60 ? Flame : score > 30 ? Sun : Snowflake

  return (
    <div className="card p-4 space-y-3">
      <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Temperatura</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: f.bg }}>
          <TempIcon className="w-5 h-5" style={{ color: f.color }} />
        </div>
        <div>
          <p className="font-bold" style={{ color: f.color }}>{f.label}</p>
          <p className="text-[11px] text-dark-muted">Score {score}/100</p>
        </div>
      </div>
      {dias !== null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-dark-muted">Último contato</span>
          <span className={`font-medium ${dias >= 10 ? 'text-status-error' : dias >= 5 ? 'text-status-warning' : 'text-dark-text'}`}>
            {dias === 0 ? 'Hoje' : `${dias}d atrás`}
          </span>
        </div>
      )}
      {diasP !== null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-dark-muted">No pipeline</span>
          <span className="text-dark-text font-medium">{diasP}d</span>
        </div>
      )}
    </div>
  )
}

function CardProximaAcao({ lead }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(lead.proximaAcao || '')
  const [saving,  setSaving]  = useState(false)

  async function save() {
    setSaving(true)
    await leadUpdate(lead.id, { proximaAcao: value })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="card p-4 space-y-2">
      <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Próxima Ação</p>
      {editing ? (
        <div className="space-y-2">
          <input value={value} onChange={e => setValue(e.target.value)}
            className="input text-sm" placeholder="Ex: Ligar amanhã" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 flex-1 justify-center">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Salvar
            </button>
            <button onClick={() => { setEditing(false); setValue(lead.proximaAcao || '') }}
              className="btn-secondary text-xs px-3 py-1.5">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="w-full text-left">
          {lead.proximaAcao
            ? <p className="text-sm text-brand-accent hover:underline">{lead.proximaAcao}</p>
            : <p className="text-sm text-dark-muted/60 italic flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Agendar ação
              </p>}
        </button>
      )}
    </div>
  )
}

function CardResumo({ lead, events }) {
  const tarefas  = events.filter(e => e.tipo === 'Tarefa').length
  const contatos = events.filter(e => e.tipo !== 'Tarefa').length
  const diasP    = lead.criadoEm ? diffDias(lead.criadoEm) : 0

  return (
    <div className="card p-4 space-y-3">
      <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Resumo</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['contatos', contatos], ['tarefas', tarefas], ['dias', diasP]].map(([lbl, val]) => (
          <div key={lbl}>
            <p className="text-lg font-bold text-dark-text">{val}</p>
            <p className="text-[10px] text-dark-muted">{lbl}</p>
          </div>
        ))}
      </div>
      {lead.apoliceAtiva && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-brand-accent/10 text-brand-accent text-xs font-semibold">
          <Check className="w-3 h-3" /> Com apólice ativa
        </div>
      )}
      {!lead.apoliceAtiva && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-dark-surface2 text-dark-muted text-xs">
          <AlertCircle className="w-3 h-3" /> Sem apólice ativa
        </div>
      )}
    </div>
  )
}

// ── Event Item ────────────────────────────────────────────────────────────────

function EventItem({ ev, onDelete }) {
  const Icon = TIPO_ICONS[ev.tipo] || FileText
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-dark-border bg-dark-surface group">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--glass-bg-heavy)' }}>
        <Icon className="w-3.5 h-3.5 text-brand-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-text">{ev.nome || ev.descricao}</p>
        <p className="text-[10px] text-dark-muted mt-0.5">{ev.tipo} · {fmtDate(ev.data || ev.criado_em)}</p>
      </div>
      {onDelete && (
        <button onClick={() => onDelete(ev)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-dark-muted hover:text-status-error p-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Abas ──────────────────────────────────────────────────────────────────────

function TabTimeline({ lead, events, toast }) {
  const [form,   setForm]   = useState({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().slice(0, 16) })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const timeline = [...events].sort((a, b) => new Date(b.data || b.criado_em) - new Date(a.data || a.criado_em))

  async function add() {
    if (!form.descricao.trim()) return
    setSaving(true)
    try {
      await eventAdd({ nome: form.descricao, tipo: form.tipo, data: form.data, descricao: form.descricao, leadId: lead.id, auto: false })
      set('descricao', '')
      toast({ type: 'success', title: 'Atividade registrada' })
    } catch { toast({ type: 'error', title: 'Erro ao registrar' }) }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Registrar Atividade</p>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={form.tipo}
            onChange={v => set('tipo', v)}
            options={TIPOS_EVENTO.map(t => ({ value: t, label: t }))}
          />
          <input type="datetime-local" value={form.data} onChange={e => set('data', e.target.value)} className="input text-sm" />
        </div>
        <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
          rows={2} className="input resize-none text-sm" placeholder="Descreva o que aconteceu..." />
        <div className="flex justify-end">
          <button onClick={add} disabled={saving || !form.descricao.trim()}
            className="btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Salvar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {timeline.length === 0 && (lead.historico || []).length === 0 && (
          <p className="text-sm text-dark-muted text-center py-8">Nenhuma atividade registrada</p>
        )}
        {timeline.map(ev => <EventItem key={ev.id} ev={ev} />)}
        {[...(lead.historico || [])].reverse().map((h, i) => (
          <div key={`hist-${i}`} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-dark-border/50 bg-dark-surface/50">
            <div className="w-7 h-7 rounded-full bg-dark-surface2 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ArrowRight className="w-3.5 h-3.5 text-dark-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-dark-muted">{h.desc}</p>
              <p className="text-[10px] text-dark-muted/60 mt-0.5">{fmtDate(h.data)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabNotas({ lead, events, toast }) {
  const [descricao,     setDescricao]     = useState('')
  const [saving,        setSaving]        = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const undoTimerRef = useRef(null)

  const notas = events.filter(e => e.tipo === 'Nota').sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))

  async function add() {
    if (!descricao.trim()) return
    setSaving(true)
    try {
      await eventAdd({ nome: descricao, tipo: 'Nota', data: new Date().toISOString(), descricao, leadId: lead.id, auto: false })
      setDescricao('')
      toast({ type: 'success', title: 'Nota salva' })
    } catch { toast({ type: 'error', title: 'Erro ao salvar' }) }
    setSaving(false)
  }

  function requestDelete(ev) {
    setPendingDelete(ev.id)
    clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(async () => {
      await eventDelete(ev.id)
      setPendingDelete(null)
    }, 5000)
  }

  function undoDelete() {
    clearTimeout(undoTimerRef.current)
    setPendingDelete(null)
  }

  useEffect(() => () => clearTimeout(undoTimerRef.current), [])

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Nova Nota</p>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
          rows={3} className="input resize-none text-sm" placeholder="Escreva uma nota..." />
        <div className="flex justify-end">
          <button onClick={add} disabled={saving || !descricao.trim()} className="btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Salvar Nota
          </button>
        </div>
      </div>

      {pendingDelete && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-status-warning/10 border border-status-warning/30">
          <p className="text-sm text-status-warning">Nota removida</p>
          <button onClick={undoDelete} className="text-xs font-semibold text-status-warning hover:underline">Desfazer (5s)</button>
        </div>
      )}

      <div className="space-y-2">
        {notas.length === 0 && <p className="text-sm text-dark-muted text-center py-8">Nenhuma nota registrada</p>}
        {notas.filter(n => n.id !== pendingDelete).map(nota => (
          <EventItem key={nota.id} ev={nota} onDelete={requestDelete} />
        ))}
      </div>
    </div>
  )
}

function TabTarefas({ lead, events, toast }) {
  const [form,   setForm]   = useState({ descricao: '', data: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const tarefas = events.filter(e => e.tipo === 'Tarefa').sort((a, b) => new Date(a.data) - new Date(b.data))

  async function add() {
    if (!form.descricao.trim()) return
    setSaving(true)
    try {
      await eventAdd({ nome: form.descricao, tipo: 'Tarefa', data: form.data || new Date().toISOString(), descricao: form.descricao, leadId: lead.id, auto: false })
      setForm({ descricao: '', data: '' })
      toast({ type: 'success', title: 'Tarefa criada' })
    } catch { toast({ type: 'error', title: 'Erro ao criar tarefa' }) }
    setSaving(false)
  }

  async function toggleDone(ev) {
    const done = ev.nome?.startsWith('[DONE] ')
    await eventUpdate(ev.id, { nome: done ? ev.nome.replace('[DONE] ', '') : `[DONE] ${ev.nome}` })
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Criar Tarefa</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.descricao} onChange={e => set('descricao', e.target.value)}
            className="input text-sm col-span-2" placeholder="Título da tarefa..." />
          <input type="date" value={form.data} onChange={e => set('data', e.target.value)} className="input text-sm" />
        </div>
        <button onClick={add} disabled={saving || !form.descricao.trim()}
          className="btn-primary text-sm flex items-center gap-2">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Criar Tarefa
        </button>
      </div>

      <div className="space-y-2">
        {tarefas.length === 0 && <p className="text-sm text-dark-muted text-center py-8">Nenhuma tarefa</p>}
        {tarefas.map(ev => {
          const done = ev.nome?.startsWith('[DONE] ')
          const vencida = ev.data && !done && diffDias(ev.data) < 0
          return (
            <div key={ev.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
              ${done ? 'border-dark-border/40 opacity-60' : 'border-dark-border bg-dark-surface'}`}>
              <button onClick={() => toggleDone(ev)} className="flex-shrink-0 text-dark-muted hover:text-brand-accent transition-colors">
                {done ? <CheckSquare className="w-4 h-4 text-brand-accent" /> : <Square className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${done ? 'line-through text-dark-muted' : 'text-dark-text'}`}>
                  {ev.nome?.replace('[DONE] ', '')}
                </p>
                {ev.data && (
                  <p className={`text-[10px] mt-0.5 ${vencida ? 'text-status-error font-semibold' : 'text-dark-muted'}`}>
                    {vencida ? 'Vencida — ' : ''}{fmtDateShort(ev.data)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabQualificacao({ lead, tags, toast }) {
  const [resumo,  setResumo]  = useState(lead.resumo  || '')
  const [obs,     setObs]     = useState(lead.observacoes || '')
  const [scoring, setScoring] = useState(null)
  const debounceRef = useRef({})

  function autosave(key, val) {
    clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(() => {
      leadUpdate(lead.id, { [key]: val })
        .then(() => toast({ type: 'success', title: 'Salvo automaticamente' }))
        .catch(() => toast({ type: 'error', title: 'Erro ao salvar' }))
    }, 800)
  }

  const leadTags = lead.tags || []
  function toggleTag(tid) {
    const next = leadTags.includes(tid) ? leadTags.filter(t => t !== tid) : [...leadTags, tid]
    leadUpdate(lead.id, { tags: next })
  }

  const LBL = 'text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5'
  const UNAVAILABLE = (
    <span className="inline-flex items-center gap-1 text-[10px] text-dark-muted/60 bg-dark-surface2 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-2.5 h-2.5" /> Necessita migração DB
    </span>
  )

  return (
    <div className="space-y-5">
      {/* Score CONVES */}
      <div className="card p-4 space-y-3">
        <label className={LBL}>Score CONVES</label>
        <div className="grid grid-cols-4 gap-2">
          {SCORE_CONVES.map(s => (
            <button key={s.id} onClick={() => setScoring(s.id)}
              className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all
                ${scoring === s.id ? 'border-current' : 'border-dark-border hover:border-dark-text/30'}`}
              style={scoring === s.id ? { borderColor: s.color, background: s.bg, color: s.color } : {}}>
              <span className="text-xl font-black">{s.id}</span>
              <span className="text-[9px] font-semibold">{s.id === 'A' ? 'Máxima' : s.id === 'B' ? 'Alta' : s.id === 'C' ? 'Média' : 'Baixa'}</span>
            </button>
          ))}
        </div>
        {scoring && (
          <p className="text-xs text-dark-muted" style={{ color: SCORE_CONVES.find(s => s.id === scoring)?.color }}>
            {SCORE_CONVES.find(s => s.id === scoring)?.desc}
          </p>
        )}
        <p className="text-[10px] text-dark-muted/50 flex items-center gap-1">
          <AlertCircle className="w-2.5 h-2.5" /> Score visual apenas — salvo no DB requer migração
        </p>
      </div>

      {/* Etiquetas */}
      <div>
        <label className={LBL}>Etiquetas</label>
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <button key={t.id} onClick={() => toggleTag(t.id)}
              className="px-2.5 py-1 rounded text-xs font-medium border transition-all"
              style={leadTags.includes(t.id)
                ? { borderColor: t.cor, background: t.cor + '22', color: t.cor }
                : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Apólice Ativa */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LBL}>Apólice Ativa</label>
          <button onClick={() => leadUpdate(lead.id, { apoliceAtiva: !lead.apoliceAtiva })}
            className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all w-full
              ${lead.apoliceAtiva ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-dark-border text-dark-muted hover:border-dark-text'}`}>
            {lead.apoliceAtiva ? 'Sim — com apólice' : 'Não — sem apólice'}
          </button>
        </div>
        <div>
          <label className={LBL}>Tipo Locatário</label>
          <p className="text-sm text-dark-text">{lead.tipoLocatario || '—'}</p>
        </div>
      </div>

      {/* Campos sem coluna no DB */}
      <div className="space-y-4">
        <div>
          <label className={LBL}>Profissão/Cargo</label>
          {UNAVAILABLE}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LBL}>Faixa de Renda</label>
            {UNAVAILABLE}
          </div>
          <div>
            <label className={LBL}>Tipo Imóvel de Interesse</label>
            {UNAVAILABLE}
          </div>
          <div>
            <label className={LBL}>Possui Veículo</label>
            {UNAVAILABLE}
          </div>
          <div>
            <label className={LBL}>Possui Plano de Saúde</label>
            {UNAVAILABLE}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div>
        <label className={LBL}>Resumo</label>
        <textarea value={resumo} rows={3} className="input resize-none text-sm"
          onChange={e => { setResumo(e.target.value); autosave('resumo', e.target.value) }}
          placeholder="Contexto geral do lead..." />
      </div>

      {/* Observações */}
      <div>
        <label className={LBL}>Observações</label>
        <textarea value={obs} rows={3} className="input resize-none text-sm"
          onChange={e => { setObs(e.target.value); autosave('observacoes', e.target.value) }}
          placeholder="Observações internas..." />
      </div>
    </div>
  )
}

function TabApolices({ lead, navigate, toast }) {
  const [fichas,  setFichas]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lead.nome) return
    fetchFichasParaImport({ search: lead.nome })
      .then(setFichas)
      .finally(() => setLoading(false))
  }, [lead.nome])

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-dark-muted" />
        </div>
      ) : fichas.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-dark-muted">Nenhuma apólice ou ficha vinculada</p>
          <button onClick={() => navigate('/fichas')}
            className="btn-primary text-sm flex items-center gap-2 mx-auto">
            <Plus className="w-4 h-4" /> Criar ficha para este lead
          </button>
        </div>
      ) : (
        <>
          {fichas.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-dark-border bg-dark-surface">
              <div>
                <p className="font-semibold text-dark-text text-sm">{f.nome_interessado}</p>
                <p className="text-xs text-dark-muted mt-0.5">{f.imobiliaria || '—'} · {f.status} · {f.produto || '—'}</p>
              </div>
              <button onClick={() => navigate('/fichas/' + f.id)}
                className="btn-secondary text-xs flex items-center gap-1 flex-shrink-0">
                <ExternalLink className="w-3 h-3" /> Ver ficha
              </button>
            </div>
          ))}
          <button onClick={() => navigate('/fichas')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-dark-border text-sm text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-colors">
            <Plus className="w-4 h-4" /> Criar nova ficha
          </button>
        </>
      )}
    </div>
  )
}

// ── LeadDetalhe ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'timeline', label: 'Linha do Tempo' },
  { id: 'notas',    label: 'Notas' },
  { id: 'tarefas',  label: 'Tarefas' },
  { id: 'qualif',   label: 'Qualificação' },
  { id: 'apolices', label: 'Apólices' },
]

export default function LeadDetalhe() {
  const { id }                          = useParams()
  const navigate                        = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const state                           = useComercial()
  const toast                           = useToast()
  const [moveOpen, setMoveOpen]         = useState(false)
  const [editOpen, setEditOpen]         = useState(false)
  const moveRef                         = useRef(null)

  const lead   = state.leads?.find(l => l.id === id)
  const events = (state.events || []).filter(e => e.leadId === id)
  const tags   = state.tags || []

  const activeTab = searchParams.get('aba') || 'timeline'
  const setTab    = t => setSearchParams({ aba: t }, { replace: true })

  // Close move dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (moveRef.current && !moveRef.current.contains(e.target)) setMoveOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleMove(col, colIdx) {
    const currentIdx = PIPELINE_COLS.findIndex(c => c.id === lead.coluna)
    if (colIdx === currentIdx) return
    const msg = colIdx < currentIdx
      ? `Regredir para "${col.label}"? Descreva o motivo:`
      : `Avançar para "${col.label}"?`
    if (colIdx < currentIdx) {
      const motivo = window.prompt(msg)
      if (motivo === null) return
      await leadMover(lead.id, col.id, { motivoRegressao: motivo })
    } else {
      if (!window.confirm(msg)) return
      await leadMover(lead.id, col.id)
    }
    toast({ type: 'success', title: `Movido para ${col.label}` })
    setMoveOpen(false)
  }

  async function handleMoveDropdown(col) {
    if (col.id === lead.coluna) return
    await leadMover(lead.id, col.id)
    toast({ type: 'success', title: `Movido para ${col.label}` })
    setMoveOpen(false)
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-10 h-10 text-dark-muted" />
        <p className="text-dark-muted">Lead não encontrado</p>
        <button onClick={() => navigate('/comercial/pipeline')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Pipeline
        </button>
      </div>
    )
  }

  const currentCol = PIPELINE_COLS.find(c => c.id === lead.coluna)
  const aColor     = avatarColor(lead.nome)

  return (
    <div className="space-y-4 animate-fade-in pb-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Top bar */}
        <div className="flex items-start gap-4 flex-wrap">
          <button onClick={() => navigate('/comercial/pipeline')}
            className="flex items-center gap-1.5 text-sm text-dark-muted hover:text-dark-text transition-colors flex-shrink-0 mt-1">
            <ArrowLeft className="w-4 h-4" /> Pipeline
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base flex-shrink-0"
              style={{ background: aColor }}>
              {initials(lead.nome)}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-dark-text leading-tight truncate">{lead.nome}</h1>
              {lead.imobiliaria && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 text-dark-muted flex-shrink-0" />
                  <span className="text-sm text-dark-muted truncate">{lead.imobiliaria}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dark-border text-sm text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-colors">
              <Pencil className="w-4 h-4" /> Editar
            </button>
            {lead.telefone && (
              <a href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dark-border text-sm text-dark-muted hover:text-green-400 hover:border-green-400/40 transition-colors">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}

            {/* Mover dropdown */}
            <div ref={moveRef} className="relative">
              <button onClick={() => setMoveOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dark-border text-sm text-dark-muted hover:text-dark-text hover:border-dark-text/40 transition-colors">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: currentCol?.color }} />
                {currentCol?.label}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moveOpen ? 'rotate-180' : ''}`} />
              </button>
              {moveOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 glass-modal rounded-xl shadow-xl z-[300] py-1 overflow-hidden">
                  {PIPELINE_COLS.map(col => (
                    <button key={col.id} onClick={() => handleMoveDropdown(col)}
                      disabled={col.id === lead.coluna}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
                        ${col.id === lead.coluna ? 'text-dark-muted cursor-default' : 'text-dark-text hover:bg-dark-surface2'}`}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                      {col.label}
                      {col.id === lead.coluna && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-xs text-dark-muted">
          {lead.origem    && <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {lead.origem}</span>}
          {lead.tipo      && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {lead.tipo}</span>}
          {lead.criadoEm  && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Criado {fmtDateShort(lead.criadoEm)}</span>}
          {lead.ultimaAtividade && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Ativo {fmtDate(lead.ultimaAtividade)}</span>}
        </div>
      </div>

      {/* ── Funil ──────────────────────────────────────────────────────────── */}
      <PipelineFunnel lead={lead} onMove={handleMove} />

      {/* ── Grid principal ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">

        {/* Coluna principal */}
        <div className="min-w-0 space-y-0">
          {/* Abas */}
          <div className="flex gap-1 border-b border-dark-border mb-4 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setTab(tab.id)}
                className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                  ${activeTab === tab.id
                    ? 'border-brand-accent text-brand-accent'
                    : 'border-transparent text-dark-muted hover:text-dark-text'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'timeline' && <TabTimeline  lead={lead} events={events} toast={toast} />}
          {activeTab === 'notas'    && <TabNotas     lead={lead} events={events} toast={toast} />}
          {activeTab === 'tarefas'  && <TabTarefas   lead={lead} events={events} toast={toast} />}
          {activeTab === 'qualif'   && <TabQualificacao lead={lead} tags={tags} toast={toast} />}
          {activeTab === 'apolices' && <TabApolices  lead={lead} navigate={navigate} toast={toast} />}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <CardTemperatura  lead={lead} />
          <CardProximaAcao  lead={lead} />
          <CardResumo       lead={lead} events={events} />
        </div>
      </div>

      {editOpen && (
        <ModalEditLead lead={lead} onClose={() => setEditOpen(false)} toast={toast} />
      )}
    </div>
  )
}
