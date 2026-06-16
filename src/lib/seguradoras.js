import { supabase } from './supabase'

export const SEGURADORA_PRODUTOS = ['residencial_pf', 'comercial_pf', 'pessoa_juridica']

let catalogCache = null
let catalogPromise = null

function normalizeSeguradora(seg) {
  return {
    ...seg,
    aliases: seg.seguradora_aliases?.map(item => item.alias) || [],
    produtos: seg.seguradora_produtos?.map(item => item.produto) || [],
  }
}

async function loadCatalog() {
  const { data, error } = await supabase
    .from('seguradoras')
    .select('id, nome_canonico, ativa, logo_url, logo_path, seguradora_aliases(alias), seguradora_produtos(produto)')
    .order('nome_canonico')

  if (error) throw error

  catalogCache = (data || []).map(normalizeSeguradora)
  return catalogCache
}

export async function fetchSeguradorasCatalog({ force = false } = {}) {
  if (force) {
    catalogCache = null
    catalogPromise = null
  }

  if (catalogCache) return catalogCache
  if (!catalogPromise) {
    catalogPromise = loadCatalog().finally(() => {
      catalogPromise = null
    })
  }
  return catalogPromise
}

export async function fetchSeguradorasPorProduto(produto, { includeInactive = false } = {}) {
  const catalog = await fetchSeguradorasCatalog()
  return catalog.filter(seg => {
    if (!includeInactive && seg.ativa === false) return false
    if (!produto) return true
    return seg.produtos.includes(produto)
  })
}

export async function findSeguradoraMetaByNome(nome) {
  if (!nome) return null
  const catalog = await fetchSeguradorasCatalog()
  const normalized = nome.toLowerCase().trim()
  return catalog.find(seg =>
    seg.nome_canonico.toLowerCase() === normalized ||
    seg.aliases.some(alias => alias.toLowerCase() === normalized)
  ) || null
}

export function invalidarCacheSeguradoras() {
  catalogCache = null
  catalogPromise = null
}
