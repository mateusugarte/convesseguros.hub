import { supabase } from './supabase'
import { toNumber } from './apolices'

const STATUS_EMISSAO = ['emitida', 'enviada']
const STATUS_APOLICE_VALIDOS = ['ativa', 'renovada']

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes(`'${columnName.toLowerCase()}'`) || message.includes(`"${columnName.toLowerCase()}"`) || message.includes(columnName.toLowerCase())
}

async function fetchApolicesComissoesRows({ inicio, fim, imobiliaria, withStatusApolice = true }) {
  const selectFields = withStatusApolice
    ? 'imobiliaria, seguradora, premio_total, valor_comissao, comissao_mensal, data_emissao, status_apolice'
    : 'imobiliaria, seguradora, premio_total, valor_comissao, comissao_mensal, data_emissao'

  let q = supabase
    .from('apolices_comissoes')
    .select(selectFields)
    .in('status_emissao', STATUS_EMISSAO)

  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)

  const { data, error } = await q
  if (error) {
    if (withStatusApolice && isMissingColumnError(error, 'status_apolice')) {
      return fetchApolicesComissoesRows({ inicio, fim, imobiliaria, withStatusApolice: false })
    }
    throw error
  }

  const rows = data || []
  return withStatusApolice
    ? rows.filter(r => !r.status_apolice || STATUS_APOLICE_VALIDOS.includes(r.status_apolice))
    : rows
}

// Comissão Gerada no mês: soma de valor_comissao das apólices emitidas no período.
export async function fetchComissaoGerada({ inicio, fim }) {
  const data = await fetchApolicesComissoesRows({ inicio, fim })
  return (data || []).reduce((sum, r) => sum + (toNumber(r.valor_comissao) || 0), 0)
}

// Quantidade de apólices emitidas no período.
export async function fetchApolicesEmitidasCount({ inicio, fim }) {
  const data = await fetchApolicesComissoesRows({ inicio, fim })
  return data.length
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
  const data = await fetchApolicesComissoesRows({ inicio, fim, imobiliaria })
  return data
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

// ── Faturas (Fase 3) ──────────────────────────────────────────────────────────

// Ledger paginado para o cálculo das faturas (sempre ao vivo).
export async function fetchFaturasLedger({ imobiliaria } = {}) {
  const pageSize = 1000
  let all = []
  let from = 0
  while (true) {
    let q = supabase
      .from('apolices_comissoes')
      .select('imobiliaria, valor_parcela, parcelamento, data_emissao, numero_apolice, nome_interessado, seguradora, apolice_id, status_emissao, status_apolice')
      .in('status_emissao', STATUS_EMISSAO_PROD)
      .or(FILTRO_STATUS_APOLICE_PROD)
      .range(from, from + pageSize - 1)
    if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)
    const { data, error } = await q
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

// Status de pagamento das faturas de um mês (1º dia do mês).
export async function fetchFaturasStatus({ mes }) {
  const { data, error } = await supabase
    .from('faturas_imobiliaria')
    .select('imobiliaria, status, data_pagamento, pago_por, observacao')
    .eq('mes_referencia', mes)
  if (error) throw error
  const map = {}
  for (const r of data || []) map[r.imobiliaria] = r
  return map
}

export async function marcarFaturaPaga({ imobiliaria, mes, userId, observacao }) {
  const { error } = await supabase.from('faturas_imobiliaria').upsert(
    {
      imobiliaria,
      mes_referencia: mes,
      status: 'pago',
      data_pagamento: new Date().toISOString().slice(0, 10),
      pago_por: userId || null,
      observacao: observacao || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'imobiliaria,mes_referencia' },
  )
  return error
}

export async function reabrirFatura({ imobiliaria, mes }) {
  const { error } = await supabase.from('faturas_imobiliaria').upsert(
    {
      imobiliaria,
      mes_referencia: mes,
      status: 'pendente',
      data_pagamento: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'imobiliaria,mes_referencia' },
  )
  return error
}
