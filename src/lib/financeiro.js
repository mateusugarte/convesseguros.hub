import { supabase } from './supabase'
import { fetchApolicesFianca, fetchApolicesAtivas, fetchApolicesParaFatura, fetchImobiliariasComApolices } from './financeiroApolices'
import { gerarParcelasComissao, somarRecebimentoNoPeriodo } from './financeiroProducaoCalc'
import { primeiroDiaMes } from './financeiroCalc'

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes(`'${columnName.toLowerCase()}'`) || message.includes(`"${columnName.toLowerCase()}"`) || message.includes(columnName.toLowerCase())
}

export async function fetchComissaoGerada({ inicio, fim }) {
  const rows = await fetchApolicesFianca({ inicio, fim })
  return rows.reduce((sum, r) => sum + (Number(r.valor_comissao) || 0), 0)
}

export async function fetchApolicesEmitidasCount({ inicio, fim }) {
  const rows = await fetchApolicesFianca({ inicio, fim })
  return rows.length
}

export async function fetchRecebimentos({ inicio, fim } = {}) {
  const rows = await fetchApolicesFianca({})
  const parcelas = gerarParcelasComissao(rows)
  if (!inicio && !fim) return parcelas
  const ini = inicio ? primeiroDiaMes(inicio) : null
  const f = fim ? primeiroDiaMes(fim) : null
  return parcelas.filter(p => {
    const mes = primeiroDiaMes(p.mes_referencia)
    if (!mes) return false
    if (ini && mes < ini) return false
    if (f && mes > f) return false
    return true
  })
}

export { somarRecebimentoNoPeriodo }

export async function fetchProducaoLedger({ inicio, fim, imobiliaria } = {}) {
  return fetchApolicesFianca({ inicio, fim, imobiliaria })
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
  return fetchImobiliariasComApolices()
}

export async function fetchFaturasLedger({ imobiliaria, seguradora } = {}) {
  return fetchApolicesParaFatura({ imobiliaria, seguradora })
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
