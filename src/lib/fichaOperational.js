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

const FICHA_EXPIRATION_DAYS_BY_SEGURADORA = {
  Porto: 45,
}
const DEFAULT_APROVADA_EXPIRATION_DAYS = 30

function getDaysSince(dateValue, now) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function getFichaExpirationThresholdDays(seguradora) {
  const bucket = normalizeSeguradoraBucket(seguradora)
  return FICHA_EXPIRATION_DAYS_BY_SEGURADORA[bucket] ?? DEFAULT_APROVADA_EXPIRATION_DAYS
}

export function getFichaAgeDays(ficha = {}, now = new Date()) {
  return getDaysSince(ficha?.created_at, now)
}

// Relatórios de um período fechado (ex.: mês passado) devem refletir o estado
// "congelado" daquele período: a expiração operacional não deve avançar só
// porque o usuário está revisitando o relatório em uma data posterior.
// Períodos ainda em curso (ou sem período, ex.: histórico) seguem usando a
// data real de hoje normalmente.
export function getReportEffectiveNow(rangeEndYmd, realNow = new Date()) {
  if (!rangeEndYmd) return realNow
  const periodEnd = new Date(`${rangeEndYmd}T23:59:59`)
  if (Number.isNaN(periodEnd.getTime())) return realNow
  return periodEnd.getTime() < realNow.getTime() ? periodEnd : realNow
}

export function isFichaExpiredOperational(ficha = {}, options = {}) {
  const status = String(ficha?.status || '').toLowerCase()
  if (!status || TERMINAL_NON_EXPIRABLE_STATUSES.has(status)) return false
  if (!EXPIRABLE_BASE_STATUSES.has(status)) return false
  if (hasFichaEmittedPolicy(ficha)) return false

  if (ficha?.raw_data?.manually_expired) return true

  const now = options.now || new Date()

  if (status === 'aprovado') {
    const anchor = ficha?.finalizada_em || ficha?.created_at
    const ageDays = getDaysSince(anchor, now)
    const thresholdDays = getFichaExpirationThresholdDays(ficha?.seguradora)
    return ageDays != null && ageDays >= thresholdDays
  }

  const ageDays = getFichaAgeDays(ficha, now)
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

