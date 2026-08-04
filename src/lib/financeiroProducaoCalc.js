// Helpers puros de agregação da Produção (Fase 2).
// Sem imports de Supabase/Vite ? testáveis com `node --test`.
import { primeiroDiaMes, addMeses, formatMesAno, parseYmd } from './financeiroCalc.js'
import { apoliceBilladaNoMes, apoliceContaNaFaturaNoMes } from './financeiroFaturasCalc.js'
import { apoliceAtivaNoMes } from './financeiroElegibilidade.js'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

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
  return [...map.values()].sort((a, b) => b.comissaoGerada - a.comissaoGerada || a.qtd - b.qtd)
}

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

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function montarCalendarioAno({ ano, ledgerRows, recebimentoRows }) {
  const cells = []
  for (let m = 1; m <= 12; m++) {
    cells.push({
      mes: `${ano}-${String(m).padStart(2, '0')}-01`,
      mesNum: m,
      label: MESES_CURTOS[m - 1],
      producao: 0,
      comissaoGerada: 0,
      recebidaEstimada: 0,
      qtd: 0,
    })
  }
  for (const r of ledgerRows || []) {
    const d = parseYmd(r.data_emissao)
    if (!d || d.getFullYear() !== ano) continue
    const cell = cells[d.getMonth()]
    cell.producao += num(r.premio_total)
    cell.comissaoGerada += num(r.valor_comissao)
    cell.qtd += 1
  }
  for (const r of recebimentoRows || []) {
    const d = parseYmd(r.mes_referencia)
    if (!d || d.getFullYear() !== ano) continue
    cells[d.getMonth()].recebidaEstimada += num(r.valor_previsto)
  }
  return cells
}

export function rankingImobiliarias(rows) {
  return agruparPorImobiliaria(rows).sort((a, b) => b.premioTotal - a.premioTotal || a.qtd - b.qtd)
}

export function gerarParcelasComissao(rows) {
  const out = []
  for (const r of rows || []) {
    const parcelas = Math.max(1, Number(r.parcelamento) || 1)
    const valorComissao = num(r.valor_comissao)
    if (!valorComissao) continue
    const base = primeiroDiaMes(r.data_emissao)
    if (!base) continue
    const parcelaBase = Math.round((valorComissao / parcelas) * 100) / 100
    for (let n = 1; n <= parcelas; n++) {
      const mes = addMeses(base, n)
      const valorPrevisto = n < parcelas
        ? parcelaBase
        : Math.round((valorComissao - parcelaBase * (parcelas - 1)) * 100) / 100
      out.push({
        mes_referencia: mes,
        valor_previsto: valorPrevisto,
        numero_parcela: n,
        total_parcelas: parcelas,
        seguradora: r.seguradora || null,
        imobiliaria: r.imobiliaria || null,
        apolice_id: r.id || r.apolice_id || null,
      })
    }
  }
  return out
}

export function comissaoEstimadaProximoMes(rows, mesRef) {
  const proximo = addMeses(primeiroDiaMes(mesRef), 1)
  let total = 0
  for (const r of rows || []) {
    if (apoliceBilladaNoMes(r, proximo) && apoliceAtivaNoMes(r, proximo)) total += num(r.comissao_mensal)
  }
  return total
}

export function somarFaturaNoMes(rows, mesRef) {
  let total = 0
  for (const r of rows || []) {
    if (apoliceContaNaFaturaNoMes(r, mesRef)) total += num(r.valor_parcela)
  }
  return total
}

export function somarRecebimentoNoPeriodo(recebimentoRows, { inicio, fim }) {
  const ini = inicio ? primeiroDiaMes(inicio) : null
  const f = fim ? primeiroDiaMes(fim) : null
  let total = 0
  for (const r of recebimentoRows || []) {
    const mes = primeiroDiaMes(r.mes_referencia)
    if (!mes) continue
    if (ini && mes < ini) continue
    if (f && mes > f) continue
    total += num(r.valor_previsto)
  }
  return total
}
