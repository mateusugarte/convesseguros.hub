export function parseDecimalBR(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const raw = String(value).trim().replace(/\s+/g, '')
  if (!raw) return null

  let normalized = raw
  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(',')
    const lastDot = normalized.lastIndexOf('.')
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.')
  } else if (hasDot) {
    const dotGroups = normalized.split('.')
    const looksLikeThousands = dotGroups.length > 1 && dotGroups.slice(1).every(group => group.length === 3)
    if (looksLikeThousands) {
      normalized = normalized.replace(/\./g, '')
    }
  }

  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatDecimalBRInput(value) {
  if (value === null || value === undefined || value === '') return ''

  const numeric = typeof value === 'number' ? value : parseDecimalBR(value)
  if (numeric === null) return String(value)

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}
