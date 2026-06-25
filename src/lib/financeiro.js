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

// ── Produção (Fase 2) ─────────────────────────────────────────────────────────

const STATUS_EMISSAO_PROD = ['emitida', 'enviada']
const FILTRO_STATUS_APOLICE_PROD = 'status_apolice.in.(ativa,renovada),status_apolice.is.null'

// Linhas do ledger para agregação de produção (base = emissão).
export async function fetchProducaoLedger({ inicio, fim, imobiliaria } = {}) {
  let q = supabase
    .from('apolices_comissoes')
    .select('imobiliaria, seguradora, premio_total, valor_comissao, comissao_mensal, data_emissao')
    .in('status_emissao', STATUS_EMISSAO_PROD)
    .or(FILTRO_STATUS_APOLICE_PROD)
  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// % de repasse salvo de cada imobiliária para um mês (1º dia do mês).
export async function fetchPctImobiliarias({ mes }) {
  const { data, error } = await supabase
    .from('producao_comissao_imobiliaria')
    .select('imobiliaria, pct_comissao')
    .eq('mes_referencia', mes)
  if (error) throw error
  const map = {}
  for (const r of data || []) map[r.imobiliaria] = r.pct_comissao
  return map
}

// Upsert do % de uma imobiliária para um mês.
export async function salvarPctImobiliaria({ imobiliaria, mes, pct, userId }) {
  const { error } = await supabase
    .from('producao_comissao_imobiliaria')
    .upsert(
      {
        imobiliaria,
        mes_referencia: mes,
        pct_comissao: pct,
        atualizado_por: userId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'imobiliaria,mes_referencia' },
    )
  return error
}

// Lista de imobiliárias distintas presentes no ledger (para o seletor da Produção).
export async function fetchImobiliariasDistintas() {
  const { data, error } = await supabase
    .from('apolices_comissoes')
    .select('imobiliaria')
    .not('imobiliaria', 'is', null)
  if (error) throw error
  return [...new Set((data || []).map(r => r.imobiliaria).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
