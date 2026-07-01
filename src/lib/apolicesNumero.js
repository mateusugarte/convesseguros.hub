export function normalizeNumeroApolice(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
}

export function pickApoliceDuplicadaByNumero(rows, numeroApolice, excludeId = null) {
  const numeroNormalizado = normalizeNumeroApolice(numeroApolice)
  if (!numeroNormalizado) return null

  return (rows || [])
    .filter(row => row && (!excludeId || row.id !== excludeId))
    .filter(row => normalizeNumeroApolice(row.numero_apolice) === numeroNormalizado)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null
}
