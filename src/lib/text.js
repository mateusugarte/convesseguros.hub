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

  if (!/[ÃÂâ]/.test(trimmed)) return trimmed

  const decoded = decodeLegacyUtf8(trimmed)
    .replace(/â€”|â€“|â€"/g, '-')
    .replace(/Â/g, '')
    .normalize('NFC')

  return decoded
}

export function normalizeDisplayName(value) {
  const text = normalizeDisplayText(value)
  return text || '—'
}

