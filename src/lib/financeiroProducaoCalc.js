// Helpers puros de agregação da Produção (Fase 2).
// Sem imports de Supabase/Vite → testáveis com `node --test`.
import { primeiroDiaMes, addMeses, formatMesAno, parseYmd } from './financeiroCalc.js'
import { apoliceBilladaNoMes } from './financeiroFaturasCalc.js'

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

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Monta 12 células (uma por mês do ano) mesclando produção/comissão (ledger, por emissão)
// e a comissão recebida estimada (recebimentos, por mes_referencia).
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

// Ranking de imobiliárias por produção (prêmio total) desc.
export function rankingImobiliarias(rows) {
  return agruparPorImobiliaria(rows).sort((a, b) => b.premioTotal - a.premioTotal || a.qtd - b.qtd)
}

// Gera o calendário de comissão parcelada a partir das apólices (já normalizadas).
// Para cada apólice distribui `valor_comissao` em `parcelamento` meses, começando no
// mês seguinte à emissão (regra: 1ª parcela cai no mês posterior à data de emissão).
// Retorna linhas no formato de recebimento: { mes_referencia, valor_previsto, ... }.
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

// Comissão estimada a receber NO PRÓXIMO MÊS: soma da comissão mensal das apólices
// (ativas) cujo parcelamento ainda cobre o mês seguinte ao mesRef informado.
// As apólices emitidas no mês atual entram naturalmente, pois sua 1ª parcela cai no mês seguinte.
export function comissaoEstimadaProximoMes(rows, mesRef) {
  const proximo = addMeses(primeiroDiaMes(mesRef), 1)
  let total = 0
  for (const r of rows || []) {
    if (apoliceBilladaNoMes(r, proximo)) total += num(r.comissao_mensal)
  }
  return total
}

// Soma das parcelas (valor_parcela) das apólices billadas num mês de referência.
export function somarFaturaNoMes(rows, mesRef) {
  let total = 0
  for (const r of rows || []) {
    if (apoliceBilladaNoMes(r, mesRef)) total += num(r.valor_parcela)
  }
  return total
}

// Soma das parcelas previstas que caem dentro de [inicio, fim] (mes_referencia).
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
