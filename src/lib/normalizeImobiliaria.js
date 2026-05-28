// Known alias corrections — lowercase-normalized key → canonical display form
// Add entries as you discover inconsistencies in the database
const ALIAS_MAP = {
  // Examples (uncomment/add as needed):
  // 'guarulhos': 'Guarulhos Imóveis',
  // 'rr guarulhos': 'Guarulhos Imóveis',
}

function removeAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const PREPOSITIONS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'com', 'por', 'para', 'ao', 'aos'])

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (!word) return word
      if (i !== 0 && PREPOSITIONS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export function normalizeImobiliaria(nome) {
  if (!nome) return null
  const trimmed = nome.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  const key = removeAccents(trimmed)
  if (ALIAS_MAP[key]) return ALIAS_MAP[key]
  return toTitleCase(trimmed)
}
