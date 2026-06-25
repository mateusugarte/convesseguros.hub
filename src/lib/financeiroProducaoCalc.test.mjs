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
