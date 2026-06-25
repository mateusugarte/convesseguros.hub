import { primeiroDiaMes, addMeses } from './financeiroCalc.js'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function apoliceBilladaNoMes(row, mesRef) {
  const emissao = primeiroDiaMes(row?.data_emissao)
  const alvo = primeiroDiaMes(mesRef)
  if (!emissao || !alvo) return false
  const parcelas = Math.max(Number(row?.parcelamento) || 1, 1)
  const inicio = addMeses(emissao, 1)
  const fim = addMeses(emissao, parcelas)
  return alvo >= inicio && alvo <= fim
}

export function montarFaturasMes({ rows, mesRef, pctMap = {}, statusMap = {} }) {
  const map = new Map()
  for (const r of rows || []) {
    if (!apoliceBilladaNoMes(r, mesRef)) continue
    const key = r.imobiliaria || 'Sem imobiliaria'
    const cur = map.get(key) || { imobiliaria: key, qtd: 0, valorFatura: 0 }
    cur.qtd += 1
    cur.valorFatura += num(r.valor_parcela)
    map.set(key, cur)
  }
  const lista = [...map.values()].map(item => {
    const rawPct = pctMap[item.imobiliaria]
    const pct = rawPct != null ? Number(rawPct) : null
    const st = statusMap[item.imobiliaria]
    return {
      ...item,
      pct,
      valorAPagar: pct != null ? (pct / 100) * item.valorFatura : 0,
      status: st?.status || 'pendente',
      dataPagamento: st?.data_pagamento || null,
      pagoPor: st?.pago_por || null,
      observacao: st?.observacao || '',
      valorRealFatura: st?.valor_real_fatura != null ? num(st.valor_real_fatura) : null,
      valorFaturaSnapshot: st?.valor_fatura_calculado != null ? num(st.valor_fatura_calculado) : null,
      pctSnapshot: st?.pct_comissao != null ? num(st.pct_comissao) : null,
      valorAPagarSnapshot: st?.valor_a_pagar != null ? num(st.valor_a_pagar) : null,
    }
  })
  return lista.sort((a, b) => b.valorFatura - a.valorFatura || a.imobiliaria.localeCompare(b.imobiliaria))
}
