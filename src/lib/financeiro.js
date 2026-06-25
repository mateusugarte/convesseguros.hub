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

async function fetchApolicesDiretasRows({ inicio, fim, imobiliaria } = {}) {
  let q = supabase
    .from('apolices')
    .select('id, imobiliaria, seguradora, premio_total, valor_producao, valor_comissao, parcelamento, data_emissao, status_emissao')
    .in('status_emissao', STATUS_EMISSAO)

  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)

  const { data, error } = await q
  if (error) throw error

  return (data || []).map(row => ({
    ...row,
    premio_total: row.premio_total ?? row.valor_producao ?? null,
    comissao_mensal: row.comissao_mensal ?? ((Number(row.valor_comissao) || 0) / Math.max(Number(row.parcelamento) || 1, 1)),
  }))
}

export async function fetchComissaoGerada({ inicio, fim }) {
  const data = await fetchApolicesComissoesRows({ inicio, fim })
  return (data || []).reduce((sum, r) => sum + (toNumber(r.valor_comissao) || 0), 0)
}

export async function fetchApolicesEmitidasCount({ inicio, fim }) {
  const data = await fetchApolicesComissoesRows({ inicio, fim })
  return data.length
}

export async function fetchRecebimentos({ inicio, fim }) {
  let q = supabase
    .from('comissoes_recebimentos')
    .select('mes_referencia, valor_previsto, numero_parcela, total_parcelas, seguradora, imobiliaria, apolice_id')
    .order('mes_referencia', { ascending: true })
  if (inicio) q = q.gte('mes_referencia', inicio)
  if (fim) q = q.lte('mes_referencia', fim)
  const { data, error } = await q
  if (error) throw error
  if ((data || []).length > 0) return data || []

  const apolices = await fetchApolicesDiretasRows({ inicio, fim })
  const fallback = []
  for (const ap of apolices) {
    const parcelas = Math.max(1, Number(ap.parcelamento) || 1)
    const valorComissao = toNumber(ap.valor_comissao) || 0
    if (!valorComissao) continue
    const base = ap.data_emissao ? new Date(ap.data_emissao) : null
    if (!base || Number.isNaN(base.getTime())) continue

    const parcelaBase = Math.round((valorComissao / parcelas) * 100) / 100
    for (let n = 1; n <= parcelas; n++) {
      const ref = new Date(base.getFullYear(), base.getMonth() + n, 1)
      const valorPrevisto = n < parcelas
        ? parcelaBase
        : Math.round((valorComissao - parcelaBase * (parcelas - 1)) * 100) / 100
      fallback.push({
        mes_referencia: ref.toISOString().slice(0, 10),
        valor_previsto: valorPrevisto,
        numero_parcela: n,
        total_parcelas: parcelas,
        seguradora: ap.seguradora || null,
        imobiliaria: ap.imobiliaria || null,
        apolice_id: ap.id || null,
      })
    }
  }
  return fallback
}

const STATUS_EMISSAO_PROD = ['emitida', 'enviada']
const FILTRO_STATUS_APOLICE_PROD = 'status_apolice.in.(ativa,renovada),status_apolice.is.null'

export async function fetchProducaoLedger({ inicio, fim, imobiliaria } = {}) {
  const data = await fetchApolicesComissoesRows({ inicio, fim, imobiliaria })
  if (data.length > 0) return data
  return fetchApolicesDiretasRows({ inicio, fim, imobiliaria })
}

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

export async function fetchPctImobiliariasAno({ ano }) {
  const inicio = `${ano}-01-01`
  const fim = `${ano}-12-31`
  const { data, error } = await supabase
    .from('producao_comissao_imobiliaria')
    .select('imobiliaria, mes_referencia, pct_comissao')
    .gte('mes_referencia', inicio)
    .lte('mes_referencia', fim)
  if (error) throw error
  const map = {}
  for (const r of data || []) {
    const mes = r.mes_referencia
    if (!map[mes]) map[mes] = {}
    map[mes][r.imobiliaria] = r.pct_comissao
  }
  return map
}

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

export async function fetchImobiliariasDistintas() {
  const ledger = await fetchApolicesComissoesRows({})
  if (ledger.length > 0) {
    return [...new Set(ledger.map(r => r.imobiliaria).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }

  const { data, error } = await supabase
    .from('apolices')
    .select('imobiliaria')
    .not('imobiliaria', 'is', null)
  if (error) throw error
  return [...new Set((data || []).map(r => r.imobiliaria).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

async function fetchFaturasLedgerPage({ imobiliaria, from, to, withStatusApolice = true }) {
  const selectFields = withStatusApolice
    ? 'imobiliaria, valor_parcela, parcelamento, data_emissao, numero_apolice, nome_interessado, seguradora, apolice_id, status_emissao, status_apolice'
    : 'imobiliaria, valor_parcela, parcelamento, data_emissao, numero_apolice, nome_interessado, seguradora, apolice_id, status_emissao'

  let q = supabase
    .from('apolices_comissoes')
    .select(selectFields)
    .in('status_emissao', STATUS_EMISSAO_PROD)
    .range(from, to)

  if (withStatusApolice) q = q.or(FILTRO_STATUS_APOLICE_PROD)
  if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)

  const { data, error } = await q
  if (error) {
    if (withStatusApolice && isMissingColumnError(error, 'status_apolice')) {
      return fetchFaturasLedgerPage({ imobiliaria, from, to, withStatusApolice: false })
    }
    throw error
  }
  return data || []
}

export async function fetchFaturasLedger({ imobiliaria } = {}) {
  const pageSize = 1000
  let all = []
  let from = 0
  while (true) {
    const data = await fetchFaturasLedgerPage({ imobiliaria, from, to: from + pageSize - 1 })
    all = all.concat(data)
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

const FATURAS_STATUS_SELECT = 'imobiliaria, mes_referencia, status, data_pagamento, pago_por, observacao, valor_real_fatura, valor_fatura_calculado, pct_comissao, valor_a_pagar'
const FATURAS_STATUS_SELECT_BASE = 'imobiliaria, mes_referencia, status, data_pagamento, pago_por, observacao'

export async function fetchFaturasStatus({ mes }) {
  let { data, error } = await supabase
    .from('faturas_imobiliaria')
    .select(FATURAS_STATUS_SELECT)
    .eq('mes_referencia', mes)
  if (error && isMissingColumnError(error, 'valor_real_fatura')) {
    const retry = await supabase
      .from('faturas_imobiliaria')
      .select(FATURAS_STATUS_SELECT_BASE)
      .eq('mes_referencia', mes)
    data = retry.data
    error = retry.error
  }
  if (error) throw error
  const map = {}
  for (const r of data || []) map[r.imobiliaria] = r
  return map
}

export async function fetchFaturasStatusAno({ ano }) {
  const inicio = `${ano}-01-01`
  const fim = `${ano}-12-31`
  let { data, error } = await supabase
    .from('faturas_imobiliaria')
    .select(FATURAS_STATUS_SELECT)
    .gte('mes_referencia', inicio)
    .lte('mes_referencia', fim)
  if (error && isMissingColumnError(error, 'valor_real_fatura')) {
    const retry = await supabase
      .from('faturas_imobiliaria')
      .select(FATURAS_STATUS_SELECT_BASE)
      .gte('mes_referencia', inicio)
      .lte('mes_referencia', fim)
    data = retry.data
    error = retry.error
  }
  if (error) throw error
  const map = {}
  for (const r of data || []) {
    const mes = r.mes_referencia
    if (!map[mes]) map[mes] = {}
    map[mes][r.imobiliaria] = r
  }
  return map
}

export async function salvarFaturaConferencia({ imobiliaria, mes, valorRealFatura, valorFatura, pct, valorAPagar, observacao }) {
  let { error } = await supabase.from('faturas_imobiliaria').upsert(
    {
      imobiliaria,
      mes_referencia: mes,
      valor_real_fatura: valorRealFatura ?? null,
      valor_fatura_calculado: valorFatura ?? null,
      pct_comissao: pct ?? null,
      valor_a_pagar: valorAPagar ?? null,
      observacao: observacao || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'imobiliaria,mes_referencia' },
  )
  if (error && isMissingColumnError(error, 'valor_real_fatura')) {
    const retry = await supabase.from('faturas_imobiliaria').upsert(
      {
        imobiliaria,
        mes_referencia: mes,
        observacao: observacao || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'imobiliaria,mes_referencia' },
    )
    error = retry.error
  }
  return error
}

export async function marcarFaturaPaga({ imobiliaria, mes, userId, observacao, valorRealFatura, valorFatura, pct, valorAPagar }) {
  let { error } = await supabase.from('faturas_imobiliaria').upsert(
    {
      imobiliaria,
      mes_referencia: mes,
      status: 'pago',
      data_pagamento: new Date().toISOString().slice(0, 10),
      pago_por: userId || null,
      observacao: observacao || null,
      valor_real_fatura: valorRealFatura ?? null,
      valor_fatura_calculado: valorFatura ?? null,
      pct_comissao: pct ?? null,
      valor_a_pagar: valorAPagar ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'imobiliaria,mes_referencia' },
  )
  if (error && isMissingColumnError(error, 'valor_real_fatura')) {
    const retry = await supabase.from('faturas_imobiliaria').upsert(
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
    error = retry.error
  }
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
