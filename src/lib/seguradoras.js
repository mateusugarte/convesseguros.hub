import { supabase } from './supabase'

export const SEGURADORA_PRODUTOS = [
  {
    value: 'fianca',
    label: 'Fiança',
    subprodutos: [
      { value: 'fianca:residencial_pf', label: 'Residencial PF' },
      { value: 'fianca:comercial_pf', label: 'Comercial PF' },
      { value: 'fianca:pessoa_juridica', label: 'Pessoa Jurídica' },
    ],
  },
  { value: 'auto', label: 'AUTO' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'saude', label: 'Saúde' },
  { value: 'incendio', label: 'Incêndio' },
]

export const SEGURADORA_PRODUTO_LABELS = {
  fianca: 'Fiança',
  'fianca:residencial_pf': 'Fiança - Residencial PF',
  'fianca:comercial_pf': 'Fiança - Comercial PF',
  'fianca:pessoa_juridica': 'Fiança - Pessoa Jurídica',
  auto: 'AUTO',
  consorcio: 'Consórcio',
  saude: 'Saúde',
  incendio: 'Incêndio',
}

const FIANCA_SUBTIPOS = new Set(['residencial_pf', 'comercial_pf', 'pessoa_juridica'])

function normalizeProduto(produto) {
  if (!produto) return ''
  const value = String(produto).trim()
  if (!value) return ''
  if (FIANCA_SUBTIPOS.has(value)) return `fianca:${value}`
  return value.toLowerCase()
}

function matchesProduto(cadastrado, solicitado) {
  const target = normalizeProduto(solicitado)
  if (!target) return true

  const current = normalizeProduto(cadastrado)
  if (!current) return false

  if (target.startsWith('fianca')) {
    return (
      current === 'fianca' ||
      current.startsWith('fianca:') ||
      FIANCA_SUBTIPOS.has(current)
    )
  }

  if (FIANCA_SUBTIPOS.has(target)) {
    return current === `fianca:${target}` || current === 'fianca' || FIANCA_SUBTIPOS.has(current)
  }

  return current === target
}

let catalogCache = null
let catalogPromise = null

function normalizeSeguradora(seg) {
  return {
    ...seg,
    aliases: seg.seguradora_aliases?.map(item => item.alias) || [],
    produtos: seg.seguradora_produtos?.map(item => normalizeProduto(item.produto)) || [],
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
    return seg.produtos.some(item => matchesProduto(item, produto))
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
