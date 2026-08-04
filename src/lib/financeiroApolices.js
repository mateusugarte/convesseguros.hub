import { supabase } from './supabase'
import {
  toNumber, parcelasApolice, producaoApolice, comissaoTotalApolice, comissaoMensalApolice,
} from './financeiroCalc.js'
import { apoliceAtivaHoje, apoliceAtivaNoMes } from './financeiroElegibilidade.js'
import { fetchImobiliariasCatalogMap, resolveCanonicalImobiliariaName } from './imobiliariasLogos'

const STATUS_EMISSAO = ['emitida', 'enviada']
const PRODUTOS_FIANCA = ['residencial_pf', 'comercial_pf', 'pessoa_juridica']
const FILTRO_PRODUTO_FIANCA = `produto.is.null,produto.in.(${PRODUTOS_FIANCA.join(',')})`

const SELECT_FIELDS = [
  'id', 'data_emissao', 'imobiliaria', 'seguradora', 'numero_apolice', 'nome_interessado',
  'produto', 'status_emissao', 'status_apolice', 'parcelamento', 'valor_parcela',
  'premio_liquido', 'premio_total', 'valor_producao', 'valor_comissao', 'pct_comissao',
  'pct_desconto', 'inicio_vigencia', 'fim_vigencia', 'forma_pagamento',
].join(', ')

export const FORMAS_PAGAMENTO_FATURA = ['fatura_sem_entrada', 'fatura_com_entrada']

export function normalizeApoliceRow(raw, catalogo) {
  const parcelas = parcelasApolice(raw)
  const premioTotal = producaoApolice(raw)
  const valorParcela = toNumber(raw.valor_parcela) || (parcelas ? premioTotal / parcelas : 0)
  return {
    id: raw.id,
    apolice_id: raw.id,
    imobiliaria: resolveCanonicalImobiliariaName(catalogo, raw.imobiliaria) || null,
    seguradora: raw.seguradora || null,
    numero_apolice: raw.numero_apolice || null,
    nome_interessado: raw.nome_interessado || null,
    produto: raw.produto || null,
    status_emissao: raw.status_emissao || null,
    status_apolice: raw.status_apolice || null,
    forma_pagamento: raw.forma_pagamento || null,
    data_emissao: raw.data_emissao || null,
    inicio_vigencia: raw.inicio_vigencia || null,
    fim_vigencia: raw.fim_vigencia || null,
    parcelamento: parcelas,
    valor_parcela: valorParcela,
    premio_liquido: toNumber(raw.premio_liquido),
    pct_comissao: raw.pct_comissao,
    premio_total: premioTotal,
    valor_comissao: comissaoTotalApolice(raw),
    comissao_mensal: comissaoMensalApolice(raw),
  }
}

export async function fetchApolicesFianca({ inicio, fim, imobiliaria, seguradora, somenteAtivas = false, formasPagamento, referenciaAtiva } = {}) {
  const catalogo = await fetchImobiliariasCatalogMap().catch(() => null)
  const imobiliariaCanonica = imobiliaria ? resolveCanonicalImobiliariaName(catalogo, imobiliaria) : ''
  const pageSize = 1000
  let all = []
  let from = 0

  while (true) {
    let q = supabase
      .from('apolices')
      .select(SELECT_FIELDS)
      .in('status_emissao', STATUS_EMISSAO)
      .or(FILTRO_PRODUTO_FIANCA)
      .order('data_emissao', { ascending: false })
      .range(from, from + pageSize - 1)

    if (inicio) q = q.gte('data_emissao', inicio)
    if (fim) q = q.lte('data_emissao', fim)
    if (seguradora) q = q.eq('seguradora', seguradora)
    if (formasPagamento?.length) q = q.in('forma_pagamento', formasPagamento)

    const { data, error } = await q
    if (error) throw error
    const page = data || []
    all = all.concat(page)
    if (page.length < pageSize) break
    from += pageSize
  }

  return all
    .map(row => normalizeApoliceRow(row, catalogo))
    .filter(row => {
      if (imobiliariaCanonica && row.imobiliaria !== imobiliariaCanonica) return false
      if (!somenteAtivas) return true
      return referenciaAtiva ? apoliceAtivaNoMes(row, referenciaAtiva) : apoliceAtivaHoje(row)
    })
}

export async function fetchApolicesAtivas({ imobiliaria, seguradora, mesRef } = {}) {
  return fetchApolicesFianca({ imobiliaria, seguradora, somenteAtivas: true, referenciaAtiva: mesRef })
}

export async function fetchApolicesParaFatura({ imobiliaria, seguradora } = {}) {
  return fetchApolicesFianca({
    imobiliaria,
    seguradora,
    formasPagamento: FORMAS_PAGAMENTO_FATURA,
  })
}

export async function fetchImobiliariasComApolices() {
  const catalogo = await fetchImobiliariasCatalogMap().catch(() => null)
  const { data, error } = await supabase
    .from('apolices')
    .select('imobiliaria')
    .in('status_emissao', STATUS_EMISSAO)
    .or(FILTRO_PRODUTO_FIANCA)
    .not('imobiliaria', 'is', null)
  if (error) throw error

  const nomes = (data || [])
    .map(r => resolveCanonicalImobiliariaName(catalogo, r.imobiliaria))
    .filter(Boolean)

  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b))
}
