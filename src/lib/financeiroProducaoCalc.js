// Helpers puros de agregação da Produção (Fase 2).
// Sem imports de Supabase/Vite → testáveis com `node --test`.
import { primeiroDiaMes, addMeses, formatMesAno } from './financeiroCalc.js'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// rows do ledger: [{ imobiliaria, premio_total, valor_comissao, comissao_mensal }]
export function agruparPorImobiliaria(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const key = r.imobiliaria || 'Sem imobiliária'
    const cur = map.get(key) || {
      imobiliaria: key, qtd: 0, premioTotal: 0, comissaoGerada: 0, comissaoRecebidaEstimada: 0,
    }
    cur.qtd += 1
    cur.premioTotal += num(r.premio_total)
    cur.comissaoGerada += num(r.valor_comissao)
    cur.comissaoRecebidaEstimada += num(r.comissao_mensal)
    map.set(key, cur)
  }
  // Ordena por comissão gerada (desc); desempate por nº de apólices (asc) só para
  // tornar a ordenação determinística quando duas imobiliárias têm a mesma comissão.
  return [...map.values()].sort((a, b) => b.comissaoGerada - a.comissaoGerada || a.qtd - b.qtd)
}

// rows do ledger de UMA imobiliária: [{ seguradora, premio_total, valor_comissao }]
export function agruparPorSeguradora(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const key = r.seguradora || 'Sem seguradora'
    const cur = map.get(key) || { seguradora: key, qtd: 0, premio: 0, comissao: 0 }
    cur.qtd += 1
    cur.premio += num(r.premio_total)
    cur.comissao += num(r.valor_comissao)
    map.set(key, cur)
  }
  const lista = [...map.values()]
  const totalComissao = lista.reduce((s, x) => s + x.comissao, 0)
  for (const item of lista) {
    item.pctParticipacao = totalComissao > 0
      ? Math.round((item.comissao / totalComissao) * 1000) / 10
      : 0
  }
  return lista.sort((a, b) => b.comissao - a.comissao)
}

// rows do ledger: [{ data_emissao, premio_total, valor_comissao }]
// Retorna sempre `meses` itens a partir de `desde` (1º dia do mês), preenchendo zeros.
export function agruparEvolucaoPorMes(rows, { desde, meses = 6 }) {
  const base = primeiroDiaMes(desde)
  const map = new Map()
  for (const r of rows || []) {
    const mes = primeiroDiaMes(r.data_emissao)
    if (!mes) continue
    const cur = map.get(mes) || { premio: 0, comissao: 0 }
    cur.premio += num(r.premio_total)
    cur.comissao += num(r.valor_comissao)
    map.set(mes, cur)
  }
  const out = []
  for (let i = 0; i < meses; i++) {
    const mes = addMeses(base, i)
    const found = map.get(mes)
    out.push({ mes, label: formatMesAno(mes), premio: found ? found.premio : 0, comissao: found ? found.comissao : 0 })
  }
  return out
}
