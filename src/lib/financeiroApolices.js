// Camada de dados do Financeiro lendo DIRETAMENTE de `apolices` (fonte real).
// Corrige o bug de ler `status_apolice` do ledger `apolices_comissoes` (coluna inexistente lá)
// e normaliza cada apólice para o formato consumido pelas agregações (premio_total,
// valor_comissao e comissao_mensal já calculados pela fórmula oficial).
import { supabase } from './supabase'
import {
  toNumber, parcelasApolice, producaoApolice, comissaoTotalApolice, comissaoMensalApolice,
} from './financeiroCalc.js'

const STATUS_EMISSAO = ['emitida', 'enviada']
// Produtos do Seguro Fiança (apólices de auto vivem em outras tabelas).
const PRODUTOS_FIANCA = ['residencial_pf', 'comercial_pf', 'pessoa_juridica']
const FILTRO_PRODUTO_FIANCA = `produto.is.null,produto.in.(${PRODUTOS_FIANCA.join(',')})`
const FILTRO_STATUS_ATIVA = 'status_apolice.in.(ativa,renovada),status_apolice.is.null'

const SELECT_FIELDS = [
  'id', 'data_emissao', 'imobiliaria', 'seguradora', 'numero_apolice', 'nome_interessado',
  'produto', 'status_emissao', 'status_apolice', 'parcelamento', 'valor_parcela',
  'premio_liquido', 'premio_total', 'valor_producao', 'valor_comissao', 'pct_comissao',
  'pct_desconto', 'inicio_vigencia', 'fim_vigencia',
].join(', ')

// Normaliza a apólice crua para o formato do "ledger" consumido pelas agregações/calendário.
export function normalizeApoliceRow(raw) {
  const parcelas = parcelasApolice(raw)
  const premioTotal = producaoApolice(raw)
  const valorParcela = toNumber(raw.valor_parcela) || (parcelas ? premioTotal / parcelas : 0)
  return {
    id: raw.id,
    apolice_id: raw.id,
    imobiliaria: raw.imobiliaria || null,
    seguradora: raw.seguradora || null,
    numero_apolice: raw.numero_apolice || null,
    nome_interessado: raw.nome_interessado || null,
    produto: raw.produto || null,
    status_emissao: raw.status_emissao || null,
    status_apolice: raw.status_apolice || null,
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

// Busca apólices de fiança com filtros opcionais, paginando.
// - inicio/fim: intervalo em data_emissao (YYYY-MM-DD).
// - imobiliaria/seguradora: filtros exatos.
// - somenteAtivas: restringe a status_apolice ativa/renovada (ou nulo).
export async function fetchApolicesFianca({ inicio, fim, imobiliaria, seguradora, somenteAtivas = false } = {}) {
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

    if (somenteAtivas) q = q.or(FILTRO_STATUS_ATIVA)
    if (inicio) q = q.gte('data_emissao', inicio)
    if (fim) q = q.lte('data_emissao', fim)
    if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)
    if (seguradora) q = q.eq('seguradora', seguradora)

    const { data, error } = await q
    if (error) throw error
    const page = data || []
    all = all.concat(page)
    if (page.length < pageSize) break
    from += pageSize
  }
  return all.map(normalizeApoliceRow)
}

// Apólices ativas (sem corte de data) — para "ver apólices ativas" e "apólices que contam".
export async function fetchApolicesAtivas({ imobiliaria, seguradora } = {}) {
  return fetchApolicesFianca({ imobiliaria, seguradora, somenteAtivas: true })
}

// Lista de imobiliárias distintas que possuem apólices de fiança emitidas.
export async function fetchImobiliariasComApolices() {
  const { data, error } = await supabase
    .from('apolices')
    .select('imobiliaria')
    .in('status_emissao', STATUS_EMISSAO)
    .or(FILTRO_PRODUTO_FIANCA)
    .not('imobiliaria', 'is', null)
  if (error) throw error
  return [...new Set((data || []).map(r => r.imobiliaria).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
