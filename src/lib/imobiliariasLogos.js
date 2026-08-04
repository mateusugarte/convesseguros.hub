import { supabase } from './supabase'
import { normalizeDisplayText } from './text'

function norm(value) {
  return (normalizeDisplayText(value) || String(value || '')).toLowerCase().trim()
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes(`'${columnName.toLowerCase()}'`) || message.includes(`"${columnName.toLowerCase()}"`) || message.includes(columnName.toLowerCase())
}

let cache = null

export async function fetchImobiliariasCatalogMap({ force = false } = {}) {
  if (cache && !force) return cache

  const [{ data, error }, { data: vinculacoes, error: vinculacoesError }] = await Promise.all([
    supabase
      .from('imobiliarias')
      .select('id, nome_canonico, pct_comissao, imagem_url, imagem_path, imobiliaria_aliases(alias)'),
    supabase
      .from('imobiliaria_seguradoras')
      .select('imobiliaria_id, seguradoras:seguradora_id(id, nome_canonico, logo_url, logo_path)'),
  ])

  let imobiliariasData = data
  let imobiliariasError = error

  if (imobiliariasError && isMissingColumnError(imobiliariasError, 'pct_comissao')) {
    const retry = await supabase
      .from('imobiliarias')
      .select('id, nome_canonico, imagem_url, imagem_path, imobiliaria_aliases(alias)')
    imobiliariasData = retry.data?.map(item => ({ ...item, pct_comissao: null }))
    imobiliariasError = retry.error
  }

  if (imobiliariasError) throw imobiliariasError
  if (vinculacoesError) throw vinculacoesError

  const seguradorasPorImobiliariaId = new Map()
  for (const item of vinculacoes || []) {
    const lista = seguradorasPorImobiliariaId.get(item.imobiliaria_id) || []
    if (item.seguradoras?.id) {
      lista.push({
        id: item.seguradoras.id,
        nomeCanonico: item.seguradoras.nome_canonico,
        logoUrl: item.seguradoras.logo_url,
        logoPath: item.seguradoras.logo_path,
      })
      seguradorasPorImobiliariaId.set(item.imobiliaria_id, lista)
    }
  }

  const map = new Map()
  for (const im of imobiliariasData || []) {
    const meta = {
      id: im.id,
      nomeCanonico: im.nome_canonico,
      imagemPath: im.imagem_path,
      imagemUrl: im.imagem_url,
      pctComissao: im.pct_comissao,
      registeredSeguradoras: seguradorasPorImobiliariaId.get(im.id) || [],
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

export function resolveCanonicalImobiliariaName(map, nome) {
  if (!nome) return ''
  const resolved = resolveImobiliaria(map, nome)
  return resolved?.nomeCanonico || normalizeDisplayText(nome) || String(nome).trim()
}

export function invalidarCacheImobiliarias() {
  cache = null
}
