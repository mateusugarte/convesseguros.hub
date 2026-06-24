function decodeLegacyUtf8(text) {
  try {
    return decodeURIComponent(escape(text))
  } catch {
    return text
  }
}

export function normalizeDisplayText(value) {
  if (value === null || value === undefined) return value
  if (typeof value !== 'string') return value

  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed

  if (!/[ÃƒÃ‚Ã¢]/.test(trimmed)) return trimmed

  const decoded = decodeLegacyUtf8(trimmed)
    .replace(/Ã¢â‚¬â€|Ã¢â‚¬â€œ|Ã¢â‚¬"/g, '-')
    .replace(/Ã‚/g, '')
    .normalize('NFC')

  return decoded
}

export function normalizeDisplayName(value) {
  const text = normalizeDisplayText(value)
  return text || '—'
}

export function sanitizeProprietarioNome(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  return text
    .replace(/^\((?:segurado|propriet[aá]rio|locador)\)\s*/i, '')
    .replace(/^(?:segurado|propriet[aá]rio|locador)\s*:\s*/i, '')
    .replace(/^(?:nome)\s*:\s*/i, '')
    .replace(/^(?:segurado|propriet[aá]rio|locador)\s+nome\s*:\s*/i, '')
    .replace(/^\((?:segurado|propriet[aá]rio|locador)\)\s*nome\s*:\s*/i, '')
    .trim()
}
