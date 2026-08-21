export function normalizeSpreadsheetDate(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const brazilian = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/)
  if (brazilian) {
    const year = brazilian[3].length === 2 ? `20${brazilian[3]}` : brazilian[3]
    return `${year}-${brazilian[2].padStart(2, '0')}-${brazilian[1].padStart(2, '0')}`
  }
  if (/^\d{5}$/.test(raw)) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    return new Date(excelEpoch + Number(raw) * 86400000).toISOString().slice(0, 10)
  }
  return raw
}

/**
 * Normaliza valores copiados de Excel/Sheets sem alterar o valor financeiro.
 * Aceita formatos pt-BR, en-US, moeda, percentual e contábil negativo.
 */
export function normalizeSpreadsheetNumber(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''

  const original = String(value).trim()
  if (!original || /^(?:-|—|–|R\$\s*[-—–]?)$/i.test(original)) return ''

  const negativeByParentheses = /^\s*\(.*\)\s*$/.test(original)
  let raw = original
    .replace(/[\u00a0\u202f\s]/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!raw || !/\d/.test(raw)) return ''

  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  let decimalSeparator = ''

  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? ',' : '.'
  } else if (lastComma >= 0) {
    const decimals = raw.length - lastComma - 1
    decimalSeparator = decimals > 0 && decimals <= 2 ? ',' : ''
  } else if (lastDot >= 0) {
    const decimals = raw.length - lastDot - 1
    decimalSeparator = decimals > 0 && decimals <= 2 ? '.' : ''
  }

  if (decimalSeparator) {
    const separatorIndex = raw.lastIndexOf(decimalSeparator)
    const integer = raw.slice(0, separatorIndex).replace(/[.,]/g, '')
    const decimals = raw.slice(separatorIndex + 1).replace(/[.,]/g, '')
    raw = `${integer}.${decimals}`
  } else {
    raw = raw.replace(/[.,]/g, '')
  }

  raw = raw.replace(/(?!^)-/g, '')
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) return ''
  return String(negativeByParentheses ? -Math.abs(numeric) : numeric)
}
