import { renewalStatusValue } from './autoOperational.js'

const FINAL_RENEWAL_STATUSES = new Set(['renovada', 'nao_renovada', 'outra_corretora'])
const SENT_RENEWAL_STATUSES = new Set(['enviada', 'negociando', ...FINAL_RENEWAL_STATUSES])
const PRIORITY_WEIGHT = { critical: 0, high: 1, normal: 2 }

function dateOnly(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] || ''
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function utcDay(value) {
  const iso = dateOnly(value)
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function daysBetween(from, to) {
  const start = utcDay(from)
  const end = utcDay(to)
  if (start === null || end === null) return 0
  return Math.round((end - start) / 86400000)
}

function monthRef(value, fallback) {
  return dateOnly(value).slice(0, 7) || dateOnly(fallback).slice(0, 7)
}

function personName(item = {}) {
  return item.nome_cliente
    || item.clientes_auto?.nome_completo
    || item.apolices_auto?.nome_cliente
    || item.cotacoes_auto?.nome_cliente
    || 'Cliente sem nome'
}

function emissionPolicies(item = {}) {
  if (Array.isArray(item.apolices_auto)) return item.apolices_auto
  return item.apolices_auto?.id ? [item.apolices_auto] : []
}

function waitPriority(startDate, today, criticalAfter = 3) {
  const waitingDays = Math.max(0, daysBetween(startDate, today))
  return waitingDays >= criticalAfter ? 'critical' : waitingDays >= 1 ? 'high' : 'normal'
}

function deadlineMeta(dueDate, today) {
  const overdueDays = Math.max(0, daysBetween(dueDate, today))
  if (dateOnly(dueDate) < today) {
    return {
      priority: overdueDays >= 2 ? 'critical' : 'high',
      dueLabel: overdueDays === 1 ? 'Atrasada há 1 dia' : `Atrasada há ${overdueDays} dias`,
      overdueDays,
    }
  }
  return { priority: 'high', dueLabel: 'Para hoje', overdueDays: 0 }
}

function waitingLabel(startDate, today) {
  const days = Math.max(0, daysBetween(startDate, today))
  if (!days) return 'Entrou hoje'
  return days === 1 ? 'Aguardando há 1 dia' : `Aguardando há ${days} dias`
}

function renewalHref(item, today) {
  return `/auto/renovacoes/planilha?mes=${monthRef(item.vigencia_fim, today)}`
}

/**
 * Converte o estado real da operação AUTO em uma fila única de trabalho.
 * O retorno é deliberadamente independente de React/Supabase para manter as
 * regras testáveis e reutilizáveis por outros pontos do sistema.
 */
export function buildAutoPendingNotifications({ renovacoes = [], emissoes = [], today } = {}) {
  const referenceDay = dateOnly(today) || localToday()
  const notifications = []

  renovacoes.forEach(item => {
    const status = renewalStatusValue(item)
    const name = personName(item)
    const deadline = dateOnly(item.data_limite_envio || item.vigencia_fim)
    const href = renewalHref(item, referenceDay)

    if (!SENT_RENEWAL_STATUSES.has(status) && deadline && deadline <= referenceDay) {
      const meta = deadlineMeta(deadline, referenceDay)
      notifications.push({
        id: `cotacao_envio:${item.id}`,
        kind: 'cotacao_envio',
        priority: meta.priority,
        title: `Cotação para enviar: ${name}`,
        subject: name,
        description: item.identificacao_veiculo
          ? `${item.identificacao_veiculo} · prepare ou envie a renovação.`
          : 'Prepare ou envie a cotação de renovação.',
        dueDate: deadline,
        dueLabel: meta.dueLabel,
        overdueDays: meta.overdueDays,
        actionLabel: 'Abrir renovação',
        href,
      })
    }

    const followupDate = dateOnly(item.proximo_followup_em)
    if (!FINAL_RENEWAL_STATUSES.has(status) && followupDate && followupDate <= referenceDay) {
      const meta = deadlineMeta(followupDate, referenceDay)
      notifications.push({
        id: `followup:${item.id}`,
        kind: 'followup',
        priority: meta.priority,
        title: `Fazer follow-up: ${name}`,
        subject: name,
        description: item.notas_negociacao || item.observacoes || 'Retome o contato e registre o retorno do cliente.',
        dueDate: followupDate,
        dueLabel: meta.dueLabel,
        overdueDays: meta.overdueDays,
        actionLabel: 'Registrar contato',
        href,
      })
    }
  })

  emissoes.forEach(item => {
    const stage = item.coluna || ''
    const name = personName(item)
    const startDate = dateOnly(item.data_transmissao || item.updated_at || item.created_at) || referenceDay
    const href = item.id ? `/auto/emissoes/${item.id}` : '/auto/gestao'

    if (stage === 'cotacao_feita' && startDate <= referenceDay) {
      notifications.push({
        id: `emissao:${item.id}`,
        kind: 'emissao',
        priority: waitPriority(startDate, referenceDay, 2),
        title: `Transmitir proposta: ${name}`,
        subject: name,
        description: 'A cotação está pronta; faça a emissão e registre a transmissão.',
        dueDate: startDate,
        dueLabel: waitingLabel(startDate, referenceDay),
        actionLabel: 'Fazer emissão',
        href,
      })
    }

    if (stage === 'proposta_transmitida' && emissionPolicies(item).length === 0) {
      notifications.push({
        id: `coletar_apolice:${item.id}`,
        kind: 'coletar_apolice',
        priority: waitPriority(startDate, referenceDay, 3),
        title: `Coletar apólice: ${name}`,
        subject: name,
        description: item.seguradora
          ? `Proposta transmitida para ${item.seguradora}; confirme a emissão e anexe a apólice.`
          : 'Confirme a emissão na seguradora e anexe a apólice.',
        dueDate: startDate,
        dueLabel: waitingLabel(startDate, referenceDay),
        actionLabel: 'Abrir proposta',
        href,
      })
    }

    if (stage === 'aguardando_vistoria') {
      notifications.push({
        id: `vistoria:${item.id}`,
        kind: 'vistoria',
        priority: waitPriority(startDate, referenceDay, 3),
        title: `Verificar vistoria/rastreador: ${name}`,
        subject: name,
        description: item.modelo_veiculo
          ? `${item.modelo_veiculo}${item.placa ? ` · ${item.placa}` : ''} · confirme se a exigência foi concluída.`
          : 'Confirme com o cliente e a seguradora se a exigência foi concluída.',
        dueDate: startDate,
        dueLabel: waitingLabel(startDate, referenceDay),
        actionLabel: 'Verificar processo',
        href,
      })
    }
  })

  return notifications.sort((left, right) => {
    const priority = PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
    if (priority) return priority
    const date = String(left.dueDate || '').localeCompare(String(right.dueDate || ''))
    return date || left.title.localeCompare(right.title, 'pt-BR')
  })
}
