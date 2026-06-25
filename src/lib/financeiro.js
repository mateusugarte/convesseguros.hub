import { supabase } from './supabase'
import { toNumber } from './apolices'

const STATUS_EMISSAO = ['emitida', 'enviada']
// Inclui status_apolice nulo (legado) tratado como 'ativa'
const FILTRO_STATUS_APOLICE = 'status_apolice.in.(ativa,renovada),status_apolice.is.null'

// Comissão Gerada no mês: soma de valor_comissao das apólices emitidas no período.
export async function fetchComissaoGerada({ inicio, fim }) {
  let q = supabase
    .from('apolices')
    .select('valor_comissao')
    .in('status_emissao', STATUS_EMISSAO)
    .or(FILTRO_STATUS_APOLICE)
  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  const { data, error } = await q
  if (error) throw error
  return (data || []).reduce((sum, r) => sum + (toNumber(r.valor_comissao) || 0), 0)
}

// Quantidade de apólices emitidas no período.
export async function fetchApolicesEmitidasCount({ inicio, fim }) {
  let q = supabase
    .from('apolices')
    .select('id', { count: 'exact', head: true })
    .in('status_emissao', STATUS_EMISSAO)
    .or(FILTRO_STATUS_APOLICE)
  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  const { count, error } = await q
  if (error) throw error
  return count || 0
}

// Parcelas de comissão (agenda) cujo mes_referencia cai no intervalo.
export async function fetchRecebimentos({ inicio, fim }) {
  let q = supabase
    .from('comissoes_recebimentos')
    .select('mes_referencia, valor_previsto, numero_parcela, total_parcelas, seguradora, imobiliaria, apolice_id')
    .order('mes_referencia', { ascending: true })
  if (inicio) q = q.gte('mes_referencia', inicio)
  if (fim) q = q.lte('mes_referencia', fim)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
