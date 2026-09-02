import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlarmClock, ArrowRight, BriefcaseBusiness, CalendarDays,
  Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3,
  FileCheck2, Link2, ListChecks, Loader2, NotebookPen, Pencil, Plus,
  RotateCcw, Search, Trash2, UserRound, UsersRound, X, Sparkles,
  Target, Flame, CalendarCheck2, ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Avatar, Button, EmptyState, Input, Modal, Select, Textarea } from '../components/ui'
import {
  TASK_PRIORITIES, deleteTask, dueState, fetchTaskMonth, fetchTasksForDate,
  parseDateKey, postponeTask, saveTask, searchTaskEntities, setTaskCompleted, toDateKey,
} from '../lib/tasks'

const EMPTY_TASK = {
  title: '', description: '', notes: '', task_date: toDateKey(), due_time: '',
  priority: 'medium', owner_id: '',
}

function monthBounds(date) {
  return {
    start: toDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  }
}

function buildCalendar(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const mondayOffset = (first.getDay() + 6) % 7
  const cells = []
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(first)
    day.setDate(1 - mondayOffset + index)
    cells.push({ date: day, inMonth: day >= first && day <= last, key: toDateKey(day) })
  }
  return cells
}

function buildWeek(dateKey) {
  const selected = parseDateKey(dateKey)
  const mondayOffset = (selected.getDay() + 6) % 7
  const monday = new Date(selected)
  monday.setDate(selected.getDate() - mondayOffset)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return { date, key: toDateKey(date) }
  })
}

function formatDue(value) {
  return value ? format(new Date(value), 'HH:mm') : null
}

function linkHref(link) {
  if (link.entity_type === 'policy') {
    return link.entity_source === 'apolices_auto' ? `/auto/apolices/${link.entity_id}` : `/apolices/${link.entity_id}`
  }
  if (link.entity_source === 'clientes_auto') return `/auto/clientes/${link.entity_id}`
  return `/fichas/${link.entity_id}`
}

function PriorityBadge({ priority }) {
  const meta = TASK_PRIORITIES[priority] || TASK_PRIORITIES.medium
  return (
    <span className={`task-priority is-${priority}`}>
      <span style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

function TaskCard({ task, currentUserId, onComplete, onPostpone, onEdit, onDelete, busy }) {
  const alert = dueState(task)
  const completed = task.status === 'completed'
  const assigned = task.created_by !== task.owner_id

  return (
    <article className={`task-card ${completed ? 'is-completed' : ''} ${alert ? `is-${alert.tone}` : ''}`}>
      {alert && (
        <div className="task-deadline-alert">
          <AlarmClock aria-hidden="true" />
          <strong>{alert.label}</strong>
          <span>Prazo {formatDue(task.due_at)}</span>
        </div>
      )}
      <div className="task-card-main">
        <button
          type="button"
          className="task-check"
          onClick={() => onComplete(task, !completed)}
          disabled={busy}
          aria-label={completed ? 'Reabrir tarefa' : 'Marcar tarefa como concluída'}
        >
          {completed ? <CheckCircle2 /> : <Circle />}
        </button>

        <div className="task-card-content">
          <div className="task-card-heading">
            <div>
              <h3>{task.title}</h3>
              <div className="task-meta-row">
                <span><Clock3 /> Registrada {format(new Date(task.created_at), "dd/MM 'às' HH:mm")}</span>
                {task.due_at && <span><AlarmClock /> Limite {formatDue(task.due_at)}</span>}
                {task.postponed_count > 0 && <span><RotateCcw /> Repassada {task.postponed_count}x</span>}
              </div>
            </div>
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && <p className="task-description">{task.description}</p>}
          {task.notes && (
            <div className="task-notes"><NotebookPen /><div><strong>Notas e observações</strong><p>{task.notes}</p></div></div>
          )}

          {(task.links || []).length > 0 && (
            <div className="task-links">
              {task.links.map(link => (
                <Link key={link.id} to={linkHref(link)}>
                  {link.entity_type === 'policy' ? <FileCheck2 /> : <UserRound />}
                  <span><strong>{link.entity_label}</strong>{link.entity_detail && <small>{link.entity_detail}</small>}</span>
                  <ArrowRight />
                </Link>
              ))}
            </div>
          )}

          {assigned && (
            <div className="task-assignment">
              <Avatar name={task.creator?.nome} src={task.creator?.avatar_url} size="sm" />
              <span>{task.owner_id === currentUserId ? `Atribuída por ${task.creator?.nome || 'administrador'}` : `Para ${task.owner?.nome || 'usuário'}`}</span>
            </div>
          )}
        </div>
      </div>

      <footer className="task-card-actions">
        {!completed && task.owner_id === currentUserId && (
          <button type="button" onClick={() => onPostpone(task)} disabled={busy}><RotateCcw /> Próximo dia útil</button>
        )}
        <button type="button" onClick={() => onEdit(task)} disabled={busy}><Pencil /> Editar</button>
        <button type="button" className="is-danger" onClick={() => onDelete(task)} disabled={busy}><Trash2 /> Excluir</button>
      </footer>
    </article>
  )
}

function TaskEditor({ open, task, links, profiles, isAdmin, userId, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ ...EMPTY_TASK, owner_id: userId })
  const [selectedLinks, setSelectedLinks] = useState([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(task ? {
      ...EMPTY_TASK,
      ...task,
      due_time: task.due_at ? format(new Date(task.due_at), 'HH:mm') : '',
    } : { ...EMPTY_TASK, task_date: task?.task_date || toDateKey(), owner_id: userId })
    setSelectedLinks(links || task?.links || [])
    setSearch('')
    setResults([])
  }, [open, task, links, userId])

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return undefined }
    const timer = setTimeout(async () => {
      setSearching(true)
      try { setResults(await searchTaskEntities(search)) }
      finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  function patch(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function addLink(link) {
    setSelectedLinks(current => current.some(item => item.entity_source === link.entity_source && item.entity_id === link.entity_id) ? current : [...current, link])
    setSearch('')
    setResults([])
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await saveTask({ task: form, links: selectedLinks, userId })
      toast({ type: 'success', title: form.id ? 'Tarefa atualizada' : 'Tarefa criada', message: form.owner_id !== userId ? 'A tarefa já está na agenda do usuário.' : 'Sua agenda foi atualizada.' })
      onSaved(form.task_date, form.owner_id)
    } catch (error) {
      toast({ type: 'error', title: 'Não foi possível salvar', message: error.message })
    } finally { setSaving(false) }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={form.id ? 'Editar tarefa' : isAdmin ? 'Nova tarefa ou atribuição' : 'Nova tarefa'}
      subtitle="Organize o trabalho com contexto, prioridade e um prazo claro."
      maxWidth="xl"
    >
      <form className="task-editor" onSubmit={submit}>
        <div className="task-editor-grid">
          <div className="task-editor-fields">
            <Input label="Tarefa" value={form.title} onChange={event => patch('title', event.target.value)} placeholder="Ex.: Retornar cotação para o cliente" maxLength={180} autoFocus />
            <Textarea label="Descrição" value={form.description || ''} onChange={event => patch('description', event.target.value)} placeholder="O que precisa ser feito?" rows={3} />
            <Textarea label="Notas e observações" value={form.notes || ''} onChange={event => patch('notes', event.target.value)} placeholder="Detalhes, contexto, próximos passos..." rows={4} />

            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Dia" type="date" value={form.task_date} onChange={event => patch('task_date', event.target.value)} />
              <Input label="Horário limite" type="time" value={form.due_time || ''} onChange={event => patch('due_time', event.target.value)} description="Opcional" />
              <Select label="Prioridade" value={form.priority} onChange={value => patch('priority', value)} options={Object.entries(TASK_PRIORITIES).map(([value, item]) => ({ value, label: item.label }))} />
            </div>

            {isAdmin && !form.id && (
              <Select
                label="Responsável"
                value={form.owner_id}
                onChange={value => patch('owner_id', value)}
                options={profiles.map(item => ({ value: item.id, label: item.id === userId ? `${item.nome} (eu)` : item.nome }))}
                description="Administradores podem colocar a tarefa diretamente na agenda de outro usuário."
              />
            )}
          </div>

          <aside className="task-link-picker">
            <div className="task-link-picker-title"><Link2 /><div><strong>Anexar contexto</strong><small>Clientes ou apólices</small></div></div>
            <div className="task-link-search">
              <Search />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, CPF ou nº da apólice" />
              {searching && <Loader2 className="animate-spin" />}
            </div>
            {results.length > 0 && (
              <div className="task-link-results">
                {results.map(result => (
                  <button key={`${result.entity_source}-${result.entity_id}`} type="button" onClick={() => addLink(result)}>
                    {result.entity_type === 'policy' ? <FileCheck2 /> : <UserRound />}
                    <span><strong>{result.entity_label}</strong>{result.entity_product && <em>{result.entity_product}</em>}<small>{result.entity_detail?.split(' · ').filter(part => part !== result.entity_product).join(' · ')}</small></span>
                    <Plus />
                  </button>
                ))}
              </div>
            )}
            <div className="task-selected-links">
              {selectedLinks.length === 0 ? (
                <p>Pesquise para anexar um cliente ou uma apólice a esta tarefa.</p>
              ) : selectedLinks.map(link => (
                <div key={`${link.entity_source}-${link.entity_id}`}>
                  {link.entity_type === 'policy' ? <FileCheck2 /> : <UserRound />}
                  <span><strong>{link.entity_label}</strong>{link.entity_product && <em>{link.entity_product}</em>}<small>{link.entity_detail?.split(' · ').filter(part => part !== link.entity_product).join(' · ')}</small></span>
                  <button type="button" onClick={() => setSelectedLinks(current => current.filter(item => !(item.entity_source === link.entity_source && item.entity_id === link.entity_id)))} aria-label="Remover vínculo"><X /></button>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="task-editor-actions">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving} disabled={!form.title.trim()} iconLeft={<Check />}>{form.id ? 'Salvar alterações' : form.owner_id !== userId ? 'Atribuir tarefa' : 'Criar tarefa'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Tarefas() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(toDateKey())
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateKey(toDateKey()))
  const [selectedOwner, setSelectedOwner] = useState(user?.id || '')
  const [profiles, setProfiles] = useState([])
  const [editor, setEditor] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const bounds = monthBounds(visibleMonth)

  useEffect(() => { if (user?.id && !selectedOwner) setSelectedOwner(user.id) }, [user?.id, selectedOwner])

  useEffect(() => {
    if (!profile?.is_admin) { setProfiles(profile ? [profile] : []); return }
    import('../lib/supabase').then(({ supabase }) => supabase.from('profiles').select('id, nome, avatar_url').order('nome').then(({ data }) => setProfiles(data || [])))
  }, [profile])

  const tasksQuery = useQuery({
    queryKey: ['tasks', selectedOwner, selectedDate],
    queryFn: () => fetchTasksForDate(selectedOwner, selectedDate),
    enabled: Boolean(selectedOwner),
    retry: false,
  })
  const monthQuery = useQuery({
    queryKey: ['tasks-month', selectedOwner, bounds.start, bounds.end],
    queryFn: () => fetchTaskMonth(selectedOwner, bounds.start, bounds.end),
    enabled: Boolean(selectedOwner),
    retry: false,
  })

  const tasks = tasksQuery.data || []
  const calendarCounts = useMemo(() => {
    const map = new Map()
    for (const task of monthQuery.data || []) {
      const current = map.get(task.task_date) || { total: 0, pending: 0, urgent: 0 }
      current.total += 1
      if (task.status === 'pending') current.pending += 1
      if (task.status === 'pending' && task.priority === 'urgent') current.urgent += 1
      map.set(task.task_date, current)
    }
    return map
  }, [monthQuery.data])

  const pending = tasks.filter(task => task.status === 'pending')
  const completed = tasks.filter(task => task.status === 'completed')
  const alertCount = pending.filter(task => dueState(task)).length
  const calendar = buildCalendar(visibleMonth)
  const weekDays = buildWeek(selectedDate)
  const viewingSelf = selectedOwner === user?.id
  const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0
  const nextPending = [...pending].sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0
    if (!a.due_at) return 1
    if (!b.due_at) return -1
    return new Date(a.due_at) - new Date(b.due_at)
  })[0]

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['tasks-month'] })
    queryClient.invalidateQueries({ queryKey: ['task-alert-summary'] })
  }

  async function act(task, action, successMessage) {
    setBusyId(task.id)
    try { await action(); refresh(); toast({ type: 'success', title: successMessage }) }
    catch (error) { toast({ type: 'error', title: 'Não foi possível atualizar', message: error.message }) }
    finally { setBusyId(null) }
  }

  function moveMonth(offset) {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function selectDay(key) {
    setSelectedDate(key)
    const date = parseDateKey(key)
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  function shiftWeek(offset) {
    const date = parseDateKey(selectedDate)
    date.setDate(date.getDate() + offset * 7)
    selectDay(toDateKey(date))
  }

  return (
    <div className="tasks-page">
      <section className="tasks-hero">
        <div className="tasks-hero-copy">
          <div className="tasks-kicker"><Sparkles /> Workspace pessoal</div>
          <h1>Seu dia, em ordem.</h1>
          <p>Prioridades, clientes e prazos reunidos em uma agenda feita para manter o trabalho avançando.</p>
          <div className="tasks-hero-date">
            <CalendarCheck2 />
            <span><small>{isToday(parseDateKey(selectedDate)) ? 'Agenda de hoje' : 'Agenda selecionada'}</small><strong>{format(parseDateKey(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}</strong></span>
          </div>
        </div>
        <div className="tasks-hero-command">
          <div className="tasks-progress-orbit" style={{ '--task-progress': `${completionRate * 3.6}deg` }}>
            <div><strong>{completionRate}%</strong><small>do dia</small></div>
          </div>
          <div className="tasks-hero-actions">
            {profile?.is_admin && profiles.length > 0 && (
              <Select value={selectedOwner} onChange={setSelectedOwner} options={profiles.map(item => ({ value: item.id, label: item.id === user.id ? 'Minhas tarefas' : `Atribuídas a ${item.nome}` }))} className="min-w-[220px]" />
            )}
            <Button onClick={() => setEditor({ task_date: selectedDate, owner_id: selectedOwner || user.id })} iconLeft={profile?.is_admin && !viewingSelf ? <UsersRound /> : <Plus />} iconRight={<ArrowUpRight />}>
              {profile?.is_admin && !viewingSelf ? 'Atribuir tarefa' : 'Nova tarefa'}
            </Button>
          </div>
        </div>
      </section>

      <section className="tasks-summary">
        <div className="is-pending"><span className="is-blue"><ListChecks /></span><div><small>Em movimento</small><strong>{pending.length} <em>pendentes</em></strong><p>{pending.length ? 'Continue pela próxima prioridade' : 'Tudo organizado por aqui'}</p></div></div>
        <div className={`is-deadline ${alertCount ? 'has-danger' : ''}`}><span className="is-red"><AlarmClock /></span><div><small>Prazos críticos</small><strong>{alertCount} <em>em atenção</em></strong><p>{alertCount ? 'Ação necessária na próxima hora' : 'Nenhum limite próximo'}</p></div></div>
        <div className="is-complete"><span className="is-green"><CheckCircle2 /></span><div><small>Progresso de hoje</small><strong>{completed.length} <em>concluídas</em></strong><p>{completionRate}% da agenda finalizada</p></div></div>
      </section>

      <section className="tasks-week-navigator" aria-label="Navegação rápida da semana">
        <button type="button" className="tasks-week-arrow" onClick={() => shiftWeek(-1)} aria-label="Semana anterior"><ChevronLeft /></button>
        <div className="tasks-week-days">
          {weekDays.map(day => {
            const count = calendarCounts.get(day.key)
            return (
              <button key={day.key} type="button" className={`${day.key === selectedDate ? 'is-selected' : ''} ${day.key === toDateKey() ? 'is-today' : ''}`} onClick={() => selectDay(day.key)}>
                <small>{format(day.date, 'EEE', { locale: ptBR }).replace('.', '')}</small>
                <strong>{format(day.date, 'dd')}</strong>
                <span>{count?.pending ? `${count.pending} tarefa${count.pending > 1 ? 's' : ''}` : count?.total ? 'Concluído' : 'Livre'}</span>
                {count?.urgent > 0 && <i />}
              </button>
            )
          })}
        </div>
        <button type="button" className="tasks-week-arrow" onClick={() => shiftWeek(1)} aria-label="Próxima semana"><ChevronRight /></button>
      </section>

      <div className="tasks-layout">
        <main className="tasks-list-panel">
          <header>
            <div>
              <span><Target /> {isToday(parseDateKey(selectedDate)) ? 'Foco de hoje' : format(parseDateKey(selectedDate), 'EEEE', { locale: ptBR })}</span>
              <h2>{format(parseDateKey(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</h2>
            </div>
            <div className="tasks-list-head-actions">
              <span>{pending.length} a fazer</span>
              <button type="button" onClick={() => selectDay(toDateKey())}>Ir para hoje</button>
            </div>
          </header>

          {tasksQuery.isLoading ? (
            <div className="tasks-loading"><Loader2 className="animate-spin" /> Carregando sua agenda...</div>
          ) : tasksQuery.error ? (
            <div className="tasks-error"><BriefcaseBusiness /><div><strong>Área de tarefas aguardando configuração</strong><p>{tasksQuery.error.message}. Execute a migração <code>supabase/74_tarefas_pessoais.sql</code> no Supabase.</p></div></div>
          ) : tasks.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nenhuma tarefa neste dia" description="Crie uma tarefa agora ou selecione outra data no calendário." actions={<Button onClick={() => setEditor({ task_date: selectedDate, owner_id: selectedOwner || user.id })} iconLeft={<Plus />}>Criar tarefa</Button>} />
          ) : (
            <div className="tasks-list">
              {pending.map(task => <TaskCard key={task.id} task={task} currentUserId={user.id} busy={busyId === task.id} onComplete={(item, value) => act(item, () => setTaskCompleted(item.id, value), 'Tarefa concluída')} onPostpone={item => act(item, () => postponeTask(item.id), 'Tarefa enviada para o próximo dia útil')} onEdit={setEditor} onDelete={item => act(item, () => deleteTask(item.id), 'Tarefa excluída')} />)}
              {completed.length > 0 && (
                <div className="tasks-completed-section">
                  <div className="tasks-completed-title"><CheckCircle2 /><span>Concluídas</span><b>{completed.length}</b></div>
                  {completed.map(task => <TaskCard key={task.id} task={task} currentUserId={user.id} busy={busyId === task.id} onComplete={(item, value) => act(item, () => setTaskCompleted(item.id, value), 'Tarefa reaberta')} onPostpone={() => {}} onEdit={setEditor} onDelete={item => act(item, () => deleteTask(item.id), 'Tarefa excluída')} />)}
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="tasks-calendar-panel">
          <div className="tasks-calendar-head">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ChevronLeft /></button>
            <strong>{format(visibleMonth, 'MMMM yyyy', { locale: ptBR })}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês"><ChevronRight /></button>
          </div>
          <div className="tasks-weekdays">{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="tasks-calendar-grid">
            {calendar.map(day => {
              const count = calendarCounts.get(day.key)
              return (
                <button key={day.key} type="button" className={`${day.inMonth ? '' : 'is-outside'} ${day.key === selectedDate ? 'is-selected' : ''} ${day.key === toDateKey() ? 'is-today' : ''}`} onClick={() => selectDay(day.key)}>
                  <span>{day.date.getDate()}</span>
                  {count?.total > 0 && <small className={count.urgent ? 'is-urgent' : count.pending ? '' : 'is-done'}>{count.total}</small>}
                </button>
              )
            })}
          </div>
          <div className="tasks-calendar-legend"><span><i /> Com tarefas</span><span><i className="is-urgent" /> Urgente</span><span><i className="is-done" /> Concluídas</span></div>
          <div className="tasks-day-focus">
            <header><span><Target /> Ritmo do dia</span><strong>{completionRate}%</strong></header>
            <div className="tasks-day-progress"><span style={{ width: `${completionRate}%` }} /></div>
            {nextPending ? (
              <div className="tasks-next-focus">
                <span className={nextPending.priority === 'urgent' ? 'is-urgent' : ''}><Flame /></span>
                <div><small>Próxima prioridade</small><strong>{nextPending.title}</strong><p>{nextPending.due_at ? `Prazo às ${formatDue(nextPending.due_at)}` : 'Sem horário limite'}</p></div>
              </div>
            ) : (
              <div className="tasks-focus-clear"><CheckCircle2 /><span><strong>Agenda em dia</strong><small>Nenhuma pendência nesta data.</small></span></div>
            )}
          </div>
          {profile?.is_admin && !viewingSelf && (
            <div className="tasks-admin-note"><UsersRound /><p>Você vê somente as tarefas que atribuiu a este usuário. As demais continuam privadas.</p></div>
          )}
        </aside>
      </div>

      <TaskEditor
        open={Boolean(editor)}
        task={editor}
        links={editor?.links}
        profiles={profiles.length ? profiles : [profile].filter(Boolean)}
        isAdmin={Boolean(profile?.is_admin)}
        userId={user.id}
        onClose={() => setEditor(null)}
        onSaved={(date, owner) => { setEditor(null); setSelectedOwner(owner); selectDay(date); refresh() }}
      />
    </div>
  )
}
