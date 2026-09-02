import { supabase } from './supabase'

export const TASK_PRIORITIES = {
  low: { label: 'Baixa', color: '#0f9f92' },
  medium: { label: 'Média', color: '#4f6df5' },
  high: { label: 'Alta', color: '#d58b23' },
  urgent: { label: 'Urgente', color: '#e04f5f' },
}

const ALERT_WINDOW_MINUTES = 60

const TASK_PRODUCT_LABELS = {
  residencial_pf: 'Fiança residencial',
  comercial_pf: 'Fiança comercial PF',
  pessoa_juridica: 'Fiança empresarial',
}

export function pad2(value) {
  return String(value).padStart(2, '0')
}

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseDateKey(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : new Date()
}

export function combineDateAndTime(date, time) {
  if (!date || !time) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()
}

export function dueState(task, now = new Date()) {
  if (!task?.due_at || task.status !== 'pending') return null
  const due = new Date(task.due_at)
  const minutes = Math.ceil((due.getTime() - now.getTime()) / 60000)
  if (minutes < 0) return { tone: 'overdue', label: `Atrasada ${Math.abs(minutes)} min`, minutes }
  if (minutes <= ALERT_WINDOW_MINUTES) return { tone: 'soon', label: minutes <= 1 ? 'Limite agora' : `Limite em ${minutes} min`, minutes }
  return null
}

export async function fetchTasksForDate(ownerId, date) {
  if (!ownerId || !date) return []
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      owner:profiles!tasks_owner_id_fkey(id, nome, avatar_url),
      creator:profiles!tasks_created_by_fkey(id, nome, avatar_url),
      links:task_entity_links(*)
    `)
    .eq('owner_id', ownerId)
    .eq('task_date', date)
    .order('status', { ascending: false })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchTaskMonth(ownerId, monthStart, monthEnd) {
  if (!ownerId) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('id, task_date, status, priority, due_at')
    .eq('owner_id', ownerId)
    .gte('task_date', monthStart)
    .lte('task_date', monthEnd)
  if (error) throw error
  return data || []
}

export async function fetchTaskAlertSummary(ownerId) {
  if (!ownerId) return { count: 0, overdue: 0, soon: 0, tasks: [] }
  const now = new Date()
  const limit = new Date(now.getTime() + ALERT_WINDOW_MINUTES * 60000)
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_at, task_date, priority')
    .eq('owner_id', ownerId)
    .eq('status', 'pending')
    .not('due_at', 'is', null)
    .lte('due_at', limit.toISOString())
    .order('due_at', { ascending: true })
    .limit(20)
  if (error) throw error
  const tasks = data || []
  const overdue = tasks.filter(task => new Date(task.due_at) < now).length
  return { count: tasks.length, overdue, soon: tasks.length - overdue, tasks }
}

export async function saveTask({ task, links = [], userId }) {
  const payload = {
    owner_id: task.owner_id || userId,
    title: task.title.trim(),
    description: task.description?.trim() || null,
    notes: task.notes?.trim() || null,
    task_date: task.task_date,
    due_at: combineDateAndTime(task.task_date, task.due_time),
    priority: task.priority,
  }

  let saved
  if (task.id) {
    const { data, error } = await supabase.from('tasks').update(payload).eq('id', task.id).select().single()
    if (error) throw error
    saved = data
    const { error: clearError } = await supabase.from('task_entity_links').delete().eq('task_id', saved.id)
    if (clearError) throw clearError
  } else {
    const { data, error } = await supabase.from('tasks').insert({ ...payload, created_by: userId }).select().single()
    if (error) throw error
    saved = data
  }

  if (links.length) {
    const { error } = await supabase.from('task_entity_links').insert(links.map(link => ({
      task_id: saved.id,
      entity_type: link.entity_type,
      entity_source: link.entity_source,
      entity_id: String(link.entity_id),
      entity_label: link.entity_label,
      entity_detail: link.entity_detail || null,
    })))
    if (error) throw error
  }
  return saved
}

export async function setTaskCompleted(taskId, completed) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: completed ? 'completed' : 'pending' })
    .eq('id', taskId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function postponeTask(taskId) {
  const { data, error } = await supabase.rpc('rollover_task_to_next_business_day', { target_task_id: taskId })
  if (error) throw error
  return data
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}

function safeTerm(value) {
  return String(value || '').replace(/[,%()]/g, ' ').trim()
}

export async function searchTaskEntities(term) {
  const q = safeTerm(term)
  if (q.length < 2) return []
  const pattern = `%${q}%`
  const requests = [
    supabase.from('fichas').select('id, nome_interessado, nome_empresa, cpf, cnpj, produto').or(`nome_interessado.ilike.${pattern},nome_empresa.ilike.${pattern},cpf.ilike.${pattern},cnpj.ilike.${pattern}`).limit(8),
    supabase.from('clientes_auto').select('id, nome_completo, cpf').or(`nome_completo.ilike.${pattern},cpf.ilike.${pattern}`).limit(8),
    supabase.from('apolices').select('id, numero_apolice, nome_interessado, nome_empresa, seguradora, produto').or(`numero_apolice.ilike.${pattern},nome_interessado.ilike.${pattern},nome_empresa.ilike.${pattern}`).limit(8),
    supabase.from('apolices_auto').select('id, numero_apolice, nome_cliente, seguradora').or(`numero_apolice.ilike.${pattern},nome_cliente.ilike.${pattern}`).limit(8),
  ]
  const [fichas, autoClients, policies, autoPolicies] = await Promise.all(requests)
  return [
    ...(fichas.data || []).map(row => {
      const product = TASK_PRODUCT_LABELS[row.produto] || 'Seguro Fiança'
      return { entity_type: 'client', entity_source: 'fichas', entity_id: row.id, entity_label: row.nome_interessado || row.nome_empresa || 'Cliente', entity_product: product, entity_detail: [product, row.cpf || row.cnpj].filter(Boolean).join(' · ') }
    }),
    ...(autoClients.data || []).map(row => ({ entity_type: 'client', entity_source: 'clientes_auto', entity_id: row.id, entity_label: row.nome_completo || 'Cliente Auto', entity_product: 'Seguro Auto', entity_detail: ['Seguro Auto', row.cpf].filter(Boolean).join(' · ') })),
    ...(policies.data || []).map(row => {
      const product = TASK_PRODUCT_LABELS[row.produto] || 'Seguro Fiança'
      return { entity_type: 'policy', entity_source: 'apolices', entity_id: row.id, entity_label: `Apólice ${row.numero_apolice || ''}`.trim(), entity_product: product, entity_detail: [product, row.nome_interessado || row.nome_empresa, row.seguradora].filter(Boolean).join(' · ') }
    }),
    ...(autoPolicies.data || []).map(row => ({ entity_type: 'policy', entity_source: 'apolices_auto', entity_id: row.id, entity_label: `Apólice ${row.numero_apolice || ''}`.trim(), entity_product: 'Seguro Auto', entity_detail: ['Seguro Auto', row.nome_cliente, row.seguradora].filter(Boolean).join(' · ') })),
  ]
}
