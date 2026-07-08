import { normalizeDisplayText } from './text.js'

export function normalizeImobiliariaKey(value) {
  const text = normalizeDisplayText(String(value || ''))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

  if (!text) return ''
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function sanitizeImobiliariaAliasList(aliases, nomeCanonico = '') {
  const canonicalKey = normalizeImobiliariaKey(nomeCanonico)
  const seen = new Set()
  const out = []

  for (const alias of aliases || []) {
    const display = normalizeDisplayText(String(alias || '')).trim().replace(/\s+/g, ' ')
    const key = normalizeImobiliariaKey(display)
    if (!display || !key || key === canonicalKey || seen.has(key)) continue
    seen.add(key)
    out.push(display)
  }

  return out
}

export function buildImobiliariasMappingState({ contagemPorNome = {}, imobiData = [] } = {}) {
  const normalizedCounts = new Map()
  for (const [rawName, total] of Object.entries(contagemPorNome || {})) {
    const key = normalizeImobiliariaKey(rawName)
    if (!key) continue
    normalizedCounts.set(key, (normalizedCounts.get(key) || 0) + (Number(total) || 0))
  }

  const mappedKeys = new Set()
  const mapeadasList = (imobiData || []).map(imob => {
    const aliases = sanitizeImobiliariaAliasList(
      imob.imobiliaria_aliases?.map(item => item.alias) || [],
      imob.nome_canonico
    )
    const keys = new Set(
      [imob.nome_canonico, ...aliases]
        .map(normalizeImobiliariaKey)
        .filter(Boolean)
    )

    let totalFichas = 0
    keys.forEach(key => {
      mappedKeys.add(key)
      totalFichas += normalizedCounts.get(key) || 0
    })

    return { ...imob, aliases, totalFichas }
  })

  const naoMapeadasList = Object.entries(contagemPorNome || {})
    .filter(([rawName]) => {
      const key = normalizeImobiliariaKey(rawName)
      return key && !mappedKeys.has(key)
    })
    .map(([nome, totalFichas]) => ({
      nome: normalizeDisplayText(nome) || String(nome || '').trim(),
      totalFichas,
    }))
    .sort((a, b) => b.totalFichas - a.totalFichas || a.nome.localeCompare(b.nome))

  return { mapeadasList, naoMapeadasList }
}

