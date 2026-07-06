import { normalizeDisplayText } from './text.js'

export const FICHA_EXPIRATION_DAYS = 45

const EXPIRABLE_BASE_STATUSES = new Set(['pendente', 'em_cotacao', 'em_analise', 'aprovado', 'emitido', 'expirada'])
const TERMINAL_NON_EXPIRABLE_STATUSES = new Set(['recusado', 'cancelado', 'cpf_invalido'])

export function normalizeSeguradoraBucket(seguradora) {
  const raw = normalizeDisplayText(seguradora) || ''
  if (!raw) return 'Não informado'

  const text = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  if (text.includes('porto')) return 'Porto'
  if (text.includes('tokio')) return 'Tokio'
  if (text.includes('too')) return 'Too'
  if (text.includes('pottencial') || text.includes('potencial')) return 'Pottencial'
  if (text.includes('junto')) return 'Junto'

  return 'Não informado'
}

export function hasFichaEmittedPolicy(ficha = {}) {
  return Boolean(
    ficha?._hasEmittedPolicy ||
    ficha?._effectiveNumeroApolice ||
    ficha?.numero_apolice ||
    ficha?._apolice?.numero_apolice ||
    ficha?._apolice?.data_emissao ||
    ficha?.data_emissao
  )
}

export function getFichaAgeDays(ficha = {}, now = new Date()) {
  if (!ficha?.created_at) return null
  const createdAt = new Date(ficha.created_at)
  if (Number.isNaN(createdAt.getTime())) return null
  return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
}

export function isFichaExpiredOperational(ficha = {}, options = {}) {
  const status = String(ficha?.status || '').toLowerCase()
  if (!status || TERMINAL_NON_EXPIRABLE_STATUSES.has(status)) return false
  if (!EXPIRABLE_BASE_STATUSES.has(status)) return false
  if (hasFichaEmittedPolicy(ficha)) return false

  const ageDays = getFichaAgeDays(ficha, options.now)
  return ageDays != null && ageDays >= FICHA_EXPIRATION_DAYS
}

export function getFichaDisplayStatus(ficha = {}, options = {}) {
  if (isFichaExpiredOperational(ficha, options)) return 'expirada'
  return String(ficha?.status || '').toLowerCase() || null
}

export function getFichaOperationalState(ficha = {}, options = {}) {
  const raw = ficha?.raw_data || {}
  const hasPolicy = hasFichaEmittedPolicy(ficha)
  const operationalStatus = getFichaDisplayStatus(ficha, options)

  if (isFichaExpiredOperational(ficha, options)) {
    return { id: 'expirada', label: 'Expirada', className: 'badge-muted' }
  }
  if (hasPolicy && raw.recovered_after_cobranca) {
    return { id: 'recuperados', label: 'Recuperada', className: 'badge-purple' }
  }
  if (raw.cobranca_started_at && !hasPolicy && operationalStatus === 'aprovado') {
    return { id: 'enviado_cobranca', label: 'Enviado Cobranca', className: 'badge-blue' }
  }
  if (hasPolicy) {
    return { id: 'emitida', label: 'Emitida', className: 'badge-purple' }
  }
  if (operationalStatus === 'expirada') {
    return { id: 'expirada', label: 'Expirada', className: 'badge-muted' }
  }
  if (operationalStatus === 'aprovado') {
    return { id: 'aprovada', label: 'Aprovada', className: 'badge-success' }
  }
  if (ficha?.status === 'cancelado') {
    return { id: 'desistiu', label: 'Desistiu', className: 'badge-muted' }
  }
  if (ficha?.status === 'recusado') {
    return { id: 'recusada', label: 'Recusada', className: 'badge-danger' }
  }
  return null
}

export function isFichaApprovedOperational(ficha = {}, options = {}) {
  return getFichaOperationalState(ficha, options)?.id === 'aprovada'
}

export function isFichaPendingEmission(ficha = {}, options = {}) {
  const id = getFichaOperationalState(ficha, options)?.id
  return id === 'aprovada' || id === 'enviado_cobranca'
}

export function withFichaOperationalStatus(ficha = {}, options = {}) {
  const operationalStatus = getFichaDisplayStatus(ficha, options)
  if (!operationalStatus || ficha?.status === operationalStatus) return ficha
  return {
    ...ficha,
    status: operationalStatus,
    _originalStatus: ficha?.status || null,
  }
}

export function mapFichasWithOperationalStatus(rows = [], options = {}) {
  return rows.map(row => withFichaOperationalStatus(row, options))
}

