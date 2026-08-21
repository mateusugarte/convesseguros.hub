import { parseRenovacoesPaste } from './autoOperational.js'
import { normalizePolicyImportIdentity } from './autoPolicyImport.js'
import { normalizeSpreadsheetDate } from './spreadsheetPaste.js'

function normalizeHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase()
}

export function isIsoCalendarDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isRenewalDateInMonth(value, monthRef) {
  return isIsoCalendarDate(value) && String(value).slice(0, 7) === String(monthRef || '')
}

export function alignRenewalDateToMonth(value, monthRef) {
  if (!isIsoCalendarDate(value) || !/^\d{4}-\d{2}$/.test(String(monthRef || ''))) return ''
  const [year, month] = monthRef.split('-').map(Number)
  const requestedDay = Number(String(value).slice(8, 10))
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(requestedDay, lastDay)).padStart(2, '0')}`
}

export function isNamesOnlyRenewalPaste(changes = []) {
  const meaningful = changes.filter(change => String(change.value || '').trim())
  return meaningful.length > 0 && meaningful.every(change => (
    change.column?.field === 'vigencia_fim' && !isIsoCalendarDate(change.value)
  ))
}

export function renewalDraftIssue(row = {}, monthRef) {
  if (!String(row.nome_cliente || '').trim()) return 'missing_name'
  if (!isIsoCalendarDate(row.vigencia_fim)) return 'invalid_date'
  if (!isRenewalDateInMonth(row.vigencia_fim, monthRef)) return 'outside_month'
  return null
}

export function normalizeRenewalIdentity(row = {}) {
  const identity = normalizePolicyImportIdentity({ nome_cliente: row.nome_cliente, modelo_veiculo: row.identificacao_veiculo })
  return { ...row, nome_cliente: identity.nome_cliente, identificacao_veiculo: identity.modelo_veiculo }
}

export function parseRenewalPlanningMatrix(matrix = [], monthRef) {
  const headerIndex = matrix.slice(0, 20).findIndex(row => {
    const headers = row.slice(0, 20).map(normalizeHeader)
    return headers.includes('data') && headers.some(header => header.includes('segurado')) && headers.some(header => header.includes('status'))
  })
  if (headerIndex < 0) return []
  const headers = matrix[headerIndex].slice(0, 20).map(normalizeHeader)
  const dateColumns = new Set(headers.flatMap((header, index) => (
    header === 'data' || header.includes('vencimento') || header.includes('vigencia') || header.includes('limite') || header.includes('prazo') ? [index] : []
  )))
  const percentColumns = new Set(headers.flatMap((header, index) => (
    header.includes('comissao') || header === 'com passada' ? [index] : []
  )))
  const text = matrix.slice(headerIndex)
    .map((row, rowIndex) => row.slice(0, 20).map((value, columnIndex) => {
      if (rowIndex > 0 && dateColumns.has(columnIndex) && typeof value === 'number') return normalizeSpreadsheetDate(value)
      if (rowIndex > 0 && percentColumns.has(columnIndex) && typeof value === 'number' && Math.abs(value) <= 1) return String(value * 100)
      return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim()
    }).join('\t'))
    .join('\n')
  return parseRenovacoesPaste(text, monthRef).map(normalizeRenewalIdentity)
}
