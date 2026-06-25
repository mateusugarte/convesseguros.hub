import { supabase } from './supabase'
import { normalizeDisplayText } from './text'

function norm(value) {
  return (normalizeDisplayText(value) || String(value || '')).toLowerCase().trim()
}

let cache = null

export async function fetchImobiliariasCatalogMap({ force = false } = {}) {
  if (cache && !force) return cache
  const { data, error } = await supabase
    .from('imobiliarias')
    .select('id, nome_canonico, pct_comissao, imagem_url, imagem_path, imobiliaria_aliases(alias)')
  if (error) throw error

  const map = new Map()
  for (const im of data || []) {
    const meta = {
      nomeCanonico: im.nome_canonico,
      imagemPath: im.imagem_path,
      imagemUrl: im.imagem_url,
      pctComissao: im.pct_comissao,
    }
    map.set(norm(im.nome_canonico), meta)
    for (const a of im.imobiliaria_aliases || []) {
      if (a?.alias) map.set(norm(a.alias), meta)
    }
  }
  cache = map
  return map
}

export function resolveImobiliaria(map, nome) {
  if (!map || !nome) return null
  return map.get(norm(nome)) || null
}

export function invalidarCacheImobiliarias() {
  cache = null
}
