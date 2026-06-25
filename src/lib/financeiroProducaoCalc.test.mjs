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
