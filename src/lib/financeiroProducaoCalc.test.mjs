import test from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparPorImobiliaria, agruparPorSeguradora, agruparEvolucaoPorMes,
} from './financeiroProducaoCalc.js'

test('agruparPorImobiliaria soma e ordena por comissão gerada desc', () => {
  const rows = [
    { imobiliaria: 'Alpha', premio_total: 1000, valor_comissao: 200, comissao_mensal: 20 },
    { imobiliaria: 'Beta',  premio_total: 500,  valor_comissao: 300, comissao_mensal: 30 },
    { imobiliaria: 'Alpha', premio_total: '500', valor_comissao: '100', comissao_mensal: '10' },
  ]
  const out = agruparPorImobiliaria(rows)
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { imobiliaria: 'Beta', qtd: 1, premioTotal: 500, comissaoGerada: 300, comissaoRecebidaEstimada: 30 })
  assert.deepEqual(out[1], { imobiliaria: 'Alpha', qtd: 2, premioTotal: 1500, comissaoGerada: 300, comissaoRecebidaEstimada: 30 })
})

test('agruparPorSeguradora calcula % de participação sobre a comissão total', () => {
  const rows = [
    { seguradora: 'Porto', premio_total: 100, valor_comissao: 75 },
    { seguradora: 'Tokio', premio_total: 100, valor_comissao: 25 },
  ]
  const out = agruparPorSeguradora(rows)
  assert.equal(out.length, 2)
  assert.equal(out[0].seguradora, 'Porto')
  assert.equal(out[0].comissao, 75)
  assert.equal(out[0].pctParticipacao, 75)
  assert.equal(out[1].pctParticipacao, 25)
})

test('agruparPorSeguradora com comissão total zero não divide por zero', () => {
  const rows = [{ seguradora: 'Porto', premio_total: 100, valor_comissao: 0 }]
  const out = agruparPorSeguradora(rows)
  assert.equal(out[0].pctParticipacao, 0)
})

test('agruparEvolucaoPorMes preenche todos os meses da janela com zeros', () => {
  const rows = [
    { data_emissao: '2026-05-10', premio_total: 1000, valor_comissao: 200 },
    { data_emissao: '2026-05-20', premio_total: 500,  valor_comissao: 100 },
  ]
  const out = agruparEvolucaoPorMes(rows, { desde: '2026-04-01', meses: 3 })
  assert.equal(out.length, 3)
  assert.deepEqual(out.map(o => o.mes), ['2026-04-01', '2026-05-01', '2026-06-01'])
  assert.deepEqual(out.map(o => o.comissao), [0, 300, 0])
  assert.deepEqual(out.map(o => o.premio), [0, 1500, 0])
  assert.equal(out[1].label, 'Mai/2026')
})

import { montarCalendarioAno, rankingImobiliarias } from './financeiroProducaoCalc.js'

test('montarCalendarioAno distribui produção/comissão/recebimentos nos 12 meses do ano', () => {
  const ledgerRows = [
    { data_emissao: '2026-01-10', premio_total: 1000, valor_comissao: 200 },
    { data_emissao: '2026-01-20', premio_total: 500,  valor_comissao: 100 },
    { data_emissao: '2026-03-05', premio_total: 800,  valor_comissao: 160 },
    { data_emissao: '2025-12-31', premio_total: 999,  valor_comissao: 99 }, // ano diferente: ignorado
  ]
  const recebimentoRows = [
    { mes_referencia: '2026-02-01', valor_previsto: 50 },
    { mes_referencia: '2026-02-01', valor_previsto: 25 },
  ]
  const cells = montarCalendarioAno({ ano: 2026, ledgerRows, recebimentoRows })
  assert.equal(cells.length, 12)
  assert.equal(cells[0].label, 'Jan')
  assert.equal(cells[0].producao, 1500)
  assert.equal(cells[0].comissaoGerada, 300)
  assert.equal(cells[0].qtd, 2)
  assert.equal(cells[1].recebidaEstimada, 75)
  assert.equal(cells[2].producao, 800)
  assert.equal(cells[2].mesNum, 3)
  assert.equal(cells[11].producao, 0)
})

test('rankingImobiliarias ordena por prêmio (produção) desc', () => {
  const rows = [
    { imobiliaria: 'Alpha', premio_total: 100, valor_comissao: 90, comissao_mensal: 9 },
    { imobiliaria: 'Beta',  premio_total: 500, valor_comissao: 10, comissao_mensal: 1 },
  ]
  const out = rankingImobiliarias(rows)
  assert.equal(out[0].imobiliaria, 'Beta')
  assert.equal(out[0].premioTotal, 500)
  assert.equal(out[1].imobiliaria, 'Alpha')
})

import { gerarParcelasComissao, somarRecebimentoNoPeriodo } from './financeiroProducaoCalc.js'

test('gerarParcelasComissao distribui a comissão a partir do mês seguinte à emissão', () => {
  const rows = [
    { id: 'a1', imobiliaria: 'Alpha', seguradora: 'Porto', data_emissao: '2026-06-15', valor_comissao: 580, parcelamento: 29 },
  ]
  const out = gerarParcelasComissao(rows)
  assert.equal(out.length, 29)
  // 1ª parcela cai em julho (mês seguinte à emissão de junho)
  assert.equal(out[0].mes_referencia, '2026-07-01')
  assert.equal(out[0].valor_previsto, 20)
  // soma das parcelas reconstrói o total
  const total = out.reduce((s, r) => s + r.valor_previsto, 0)
  assert.equal(Math.round(total * 100) / 100, 580)
})

test('gerarParcelasComissao ignora apólices sem comissão ou sem data', () => {
  const rows = [
    { id: 'x', data_emissao: '2026-06-15', valor_comissao: 0, parcelamento: 12 },
    { id: 'y', data_emissao: null, valor_comissao: 100, parcelamento: 12 },
  ]
  assert.equal(gerarParcelasComissao(rows).length, 0)
})

test('somarRecebimentoNoPeriodo filtra por mes_referencia dentro do intervalo', () => {
  const rec = [
    { mes_referencia: '2026-07-01', valor_previsto: 20 },
    { mes_referencia: '2026-08-01', valor_previsto: 20 },
    { mes_referencia: '2026-09-01', valor_previsto: 20 },
  ]
  assert.equal(somarRecebimentoNoPeriodo(rec, { inicio: '2026-08-01', fim: '2026-08-31' }), 20)
  assert.equal(somarRecebimentoNoPeriodo(rec, { inicio: '2026-07-01', fim: '2026-09-30' }), 60)
})

import { comissaoEstimadaProximoMes, somarFaturaNoMes } from './financeiroProducaoCalc.js'

test('comissaoEstimadaProximoMes soma comissão mensal das ativas que billam no mês seguinte', () => {
  const rows = [
    // emitida em jun → 1ª parcela jul; estimativa para jul (mesRef jun) conta
    { data_emissao: '2026-06-10', parcelamento: 29, comissao_mensal: 68.96 },
    // emitida em jan/2026, 29 parcelas → cobre jul; conta
    { data_emissao: '2026-01-10', parcelamento: 29, comissao_mensal: 20 },
    // emitida em jan/2024, 12 parcelas → já encerrou; NÃO conta
    { data_emissao: '2024-01-10', parcelamento: 12, comissao_mensal: 100 },
  ]
  const total = comissaoEstimadaProximoMes(rows, '2026-06-01')
  assert.equal(Math.round(total * 100) / 100, 88.96)
})

test('somarFaturaNoMes soma valor_parcela das apólices billadas no mês', () => {
  const rows = [
    { data_emissao: '2026-06-10', parcelamento: 29, valor_parcela: 50 }, // billa a partir de jul
    { data_emissao: '2026-05-10', parcelamento: 29, valor_parcela: 30 }, // billa em jul
  ]
  assert.equal(somarFaturaNoMes(rows, '2026-07-01'), 80)
  // em junho, só a de maio billa (a de junho começa em julho)
  assert.equal(somarFaturaNoMes(rows, '2026-06-01'), 30)
})
