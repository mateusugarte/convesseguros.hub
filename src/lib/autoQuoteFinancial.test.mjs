import test from 'node:test'
import assert from 'node:assert/strict'

import {
  derivarOpcoesFinanceirasComparativo,
  mesclarOpcaoFinanceira,
  opcaoFinanceiraSincronizada,
} from './autoQuoteFinancial.js'

test('seguradora atual e sempre a preferencial e a menor vira mais barata', () => {
  const opcoes = derivarOpcoesFinanceirasComparativo({
    atual: { seguradora: 'HDI', campos: { premio_total: 'R$ 2.690,65' } },
    concorrente: { seguradora: 'Pier Seguros', campos: { premio_total: '2.324,65' } },
  })

  assert.deepEqual(opcoes.seguradora_preferencial, {
    nome: 'HDI', premio_total: 2690.65, origem: 'atual',
  })
  assert.deepEqual(opcoes.seguradora_mais_barata, {
    nome: 'Pier Seguros', premio_total: 2324.65, origem: 'concorrente',
  })
})

test('seguradora atual tambem pode ser a mais barata sem perder seu papel', () => {
  const opcoes = derivarOpcoesFinanceirasComparativo({
    atual: { seguradora: 'Bradesco', campos: { premio_total: 1800 } },
    concorrente: { seguradora: 'Tokio', campos: { premio_total: 2100 } },
  })

  assert.equal(opcoes.seguradora_preferencial.nome, 'Bradesco')
  assert.equal(opcoes.seguradora_mais_barata.nome, 'Bradesco')
})

test('nao escolhe a mais barata antes de existirem os dois premios', () => {
  const opcoes = derivarOpcoesFinanceirasComparativo({
    atual: { seguradora: 'HDI', campos: { premio_total: 1800 } },
    concorrente: { seguradora: 'Pier', campos: { premio_total: '' } },
  })

  assert.equal(opcoes.seguradora_preferencial.nome, 'HDI')
  assert.equal(opcoes.seguradora_mais_barata, null)
})

test('considera opções adicionais ao identificar o menor prêmio', () => {
  const resultado = derivarOpcoesFinanceirasComparativo({
    atual: { seguradora: 'HDI', campos: { premio_total: 2690 } },
    concorrente: { seguradora: 'Tokio', campos: { premio_total: 2450 } },
    opcoes: [{ seguradora: 'Porto', campos: { premio_total: 2190 } }],
  })

  assert.equal(resultado.seguradora_mais_barata.nome, 'Porto')
  assert.equal(resultado.seguradora_mais_barata.origem, 'opcao_3')
})

test('campos digitados permanecem para a mesma seguradora e nao vazam para outra', () => {
  const salva = { nome: 'HDI Seguros', premio_total: 2700, premio_liquido: 2500, pct_comissao: 20 }

  assert.deepEqual(
    mesclarOpcaoFinanceira(salva, { nome: 'HDI Seguros', premio_total: 2690.65 }),
    { nome: 'HDI Seguros', premio_total: 2690.65, premio_liquido: 2500, pct_comissao: 20 },
  )
  assert.deepEqual(
    mesclarOpcaoFinanceira(salva, { nome: 'Pier', premio_total: 2324.65 }),
    { nome: 'Pier', premio_total: 2324.65 },
  )
})

test('comparacao de sincronizacao aceita acentos e formato monetario brasileiro', () => {
  assert.equal(opcaoFinanceiraSincronizada(
    { nome: 'Tókio Marine', premio_total: '2.100,00' },
    { nome: 'Tokio Marine', premio_total: 2100 },
  ), true)
})
